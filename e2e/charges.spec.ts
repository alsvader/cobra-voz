import { test as plain } from "@playwright/test";
import { expect, signIn, test } from "./support/fixtures";
import { readCharges } from "./support/tenants";

const ORIGIN = `http://localhost:${process.env.PORT ?? 3100}`;
const SAME_ORIGIN = { Origin: ORIGIN };
const AMOUNT_FIELD = /Importe a cobrar \(MXN\)/;
const newKey = () => crypto.randomUUID();

test.describe("P02 → creación de cobro", () => {
  test("confirmar crea un cobro con QR de prueba y lo informa sin mostrar un QR", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/cobro/confirmar");
    await page.getByLabel(AMOUNT_FIELD).fill("150.50");
    await page.getByRole("button", { name: "Confirmar importe" }).click();

    await expect(page.getByText(/Se creó el cobro/)).toBeVisible();
    await expect(page.getByText(/CV-[0-9A-F]{8}/)).toBeVisible();
    await expect(page.getByText(/QR de prueba/)).toBeVisible();
    // Aún no hay P03: nada de QR ni de «pagado».
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.getByText(/pago recibido|pagado/i)).toHaveCount(0);

    const { charges, qrs } = await readCharges(tenant.merchantId!);
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      amountCents: 15050,
      status: "waiting_payment",
    });
    expect(qrs).toHaveLength(1);
    expect(qrs[0].qrPayload.startsWith("COBRAVOZ-MOCK|")).toBe(true);
  });

  test("clics repetidos crean un solo cobro", async ({ page, tenant }) => {
    await signIn(page, tenant);
    await page.goto("/cobro/confirmar");
    await page.getByLabel(AMOUNT_FIELD).fill("80");
    const confirm = page.getByRole("button", { name: "Confirmar importe" });

    await confirm.dblclick();
    await expect(page.getByText(/Se creó el cobro/)).toBeVisible();

    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(1);
  });

  test("si se pierde la respuesta, reintentar no duplica el cobro", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/cobro/confirmar");
    // El servidor procesa la petición, pero el navegador nunca recibe la respuesta.
    let dropped = false;
    await page.route("**/api/charges", async (route) => {
      if (!dropped && route.request().method() === "POST") {
        dropped = true;
        await route.fetch();
        await route.abort("connectionreset");
        return;
      }
      await route.continue();
    });

    await page.getByLabel(AMOUNT_FIELD).fill("99.90");
    await page.getByRole("button", { name: "Confirmar importe" }).click();
    await expect(page.getByText(/no se duplicará/i)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar importe" }).click();

    await expect(page.getByText(/Se creó el cobro/)).toBeVisible();
    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(1);
  });

  test("un importe distinto después de un error es una intención nueva", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/cobro/confirmar?centavos=10000");
    await page.route("**/api/charges", (route) => route.abort());
    await page.getByRole("button", { name: "Confirmar importe" }).click();
    await expect(page.getByText(/no se duplicará/i)).toBeVisible();
    await page.unroute("**/api/charges");

    await page.getByRole("button", { name: "Corregir importe" }).click();
    await page.getByLabel(AMOUNT_FIELD).fill("200");
    await page.getByRole("button", { name: "Confirmar importe" }).click();

    await expect(page.getByText(/Se creó el cobro/)).toBeVisible();
    const { charges } = await readCharges(tenant.merchantId!);
    expect(charges).toHaveLength(1);
    expect(charges[0].amountCents).toBe(20000);
  });

  test("resultado incierto de Pey: lo explica, deja incidencia y no reintenta", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/cobro/confirmar");
    // $13.01 es el importe mágico del simulador que fuerza un timeout.
    await page.getByLabel(AMOUNT_FIELD).fill("13.01");
    await page.getByRole("button", { name: "Confirmar importe" }).click();

    await expect(page.getByText("No pudimos confirmar el QR")).toBeVisible();
    await expect(
      page.getByText(/No se creó ningún cobro adicional/),
    ).toBeVisible();
    await expect(page.getByText(/Se creó el cobro/)).toHaveCount(0);

    const { charges, qrs, incidents } = await readCharges(tenant.merchantId!);
    expect(charges).toHaveLength(1);
    expect(charges[0].status).toBe("qr_uncertain");
    expect(qrs).toHaveLength(0);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe("qr_creation_uncertain");
  });

  test("con la sesión vencida redirige a A01 sin crear nada", async ({
    page,
    context,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/cobro/confirmar");
    await page.getByLabel(AMOUNT_FIELD).fill("50");
    await context.clearCookies();
    await page.getByRole("button", { name: "Confirmar importe" }).click();

    await expect(page).toHaveURL(/\/acceso\?motivo=sesion-expirada/);
    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(0);
  });
});

test.describe("API /api/charges", () => {
  plain("sin sesión responde 401 en POST y GET", async ({ request }) => {
    const post = await request.post("/api/charges", {
      headers: SAME_ORIGIN,
      data: { amountCents: 100, idempotencyKey: newKey() },
    });
    const get = await request.get(`/api/charges/${newKey()}`);

    expect(post.status()).toBe(401);
    expect(get.status()).toBe(401);
    expect(post.headers()["cache-control"]).toContain("no-store");
  });

  test("POST sin Origin o con Origin ajeno se rechaza (403) y no crea nada", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    const data = { amountCents: 100, idempotencyKey: newKey() };

    const sinOrigin = await page.request.post("/api/charges", { data });
    const ajeno = await page.request.post("/api/charges", {
      data,
      headers: { Origin: "https://evil.example" },
    });

    expect(sinOrigin.status()).toBe(403);
    expect(ajeno.status()).toBe(403);
    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(0);
  });

  test("crea (201), repite (200 mismo cobro) y detecta conflicto de importe (409)", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    const idempotencyKey = newKey();
    const post = (amountCents: number) =>
      page.request.post("/api/charges", {
        headers: SAME_ORIGIN,
        data: { amountCents, idempotencyKey },
      });

    const first = await post(15050);
    const second = await post(15050);
    const conflict = await post(99900);

    expect(first.status()).toBe(201);
    expect(second.status()).toBe(200);
    expect(conflict.status()).toBe(409);
    expect(first.headers()["cache-control"]).toContain("no-store");

    const a = await first.json();
    const b = await second.json();
    expect(a.replayed).toBe(false);
    expect(b.replayed).toBe(true);
    expect(b.charge.id).toBe(a.charge.id);
    expect(a.charge).toMatchObject({
      amountCents: 15050,
      currency: "MXN",
      status: "waiting_payment",
    });
    expect(a.charge.qr.simulated).toBe(true);
    // Nada interno hacia el cliente.
    expect(JSON.stringify(a)).not.toMatch(/merchantId|numRef|peyQrId|mock-qr-/);

    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(1);
  });

  test("peticiones simultáneas con la misma clave crean un solo cobro", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    const idempotencyKey = newKey();

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        page.request.post("/api/charges", {
          headers: SAME_ORIGIN,
          data: { amountCents: 25000, idempotencyKey },
        }),
      ),
    );

    for (const response of responses) {
      expect([200, 201]).toContain(response.status());
    }
    expect(responses.filter((r) => r.status() === 201)).toHaveLength(1);
    const { charges, qrs } = await readCharges(tenant.merchantId!);
    expect(charges).toHaveLength(1);
    expect(qrs).toHaveLength(1);
  });

  for (const [name, data] of [
    ["importe cero", { amountCents: 0 }],
    ["importe negativo", { amountCents: -5 }],
    ["importe con decimales", { amountCents: 10.5 }],
    ["importe como texto", { amountCents: "100" }],
    ["importe sobre el tope", { amountCents: 100_000_000 }],
    ["clave corta", { amountCents: 100, idempotencyKey: "corta" }],
    ["sin clave", { amountCents: 100, idempotencyKey: undefined }],
    ["campo extra", { amountCents: 100, status: "paid" }],
  ] as const) {
    test(`rechaza ${name} (400) sin crear nada`, async ({ page, tenant }) => {
      await signIn(page, tenant);

      const response = await page.request.post("/api/charges", {
        headers: SAME_ORIGIN,
        data: { idempotencyKey: newKey(), ...data },
      });

      expect(response.status()).toBe(400);
      expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(0);
    });
  }

  test("el cliente no puede elegir el comercio: merchantId en el cuerpo → 400", async ({
    page,
    tenant,
    otherTenant,
  }) => {
    await signIn(page, tenant);

    const response = await page.request.post("/api/charges", {
      headers: SAME_ORIGIN,
      data: {
        amountCents: 100,
        idempotencyKey: newKey(),
        merchantId: otherTenant.merchantId,
      },
    });

    expect(response.status()).toBe(400);
    expect((await readCharges(otherTenant.merchantId!)).charges).toHaveLength(
      0,
    );
    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(0);
  });

  test("GET devuelve el cobro propio; el de otro comercio o inexistente es 404", async ({
    browser,
    tenant,
    otherTenant,
  }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await signIn(owner, tenant);
    const created = await owner.request.post("/api/charges", {
      headers: SAME_ORIGIN,
      data: { amountCents: 15000, idempotencyKey: newKey() },
    });
    const { charge } = await created.json();

    const own = await owner.request.get(`/api/charges/${charge.id}`);
    expect(own.status()).toBe(200);
    expect((await own.json()).charge).toEqual(charge);
    expect(own.headers()["cache-control"]).toContain("no-store");

    const intruderContext = await browser.newContext();
    const intruder = await intruderContext.newPage();
    await signIn(intruder, otherTenant);
    const foreign = await intruder.request.get(`/api/charges/${charge.id}`);
    const missing = await intruder.request.get(`/api/charges/${newKey()}`);
    const malformed = await intruder.request.get("/api/charges/no-es-uuid");

    expect(foreign.status()).toBe(404);
    expect(missing.status()).toBe(404);
    expect(malformed.status()).toBe(404);
    // Un cobro ajeno es indistinguible de uno inexistente.
    expect((await foreign.json()).error.code).toBe("not_found");
    expect(JSON.stringify(await foreign.json())).not.toContain(
      charge.reference,
    );

    await ownerContext.close();
    await intruderContext.close();
  });
});
