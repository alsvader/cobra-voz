import jsQR from "jsqr";
import sharp from "sharp";
import { test as plain, type Page } from "@playwright/test";
import { expect, signIn, test } from "./support/fixtures";
import {
  insertCreatedCharge,
  markChargePaid,
  readCharges,
  setChargeExpiry,
} from "./support/tenants";
import type { Tenant } from "./support/tenants";

const ORIGIN = `http://localhost:${process.env.PORT ?? 3100}`;
const SAME_ORIGIN = { Origin: ORIGIN };
const AMOUNT_FIELD = /Importe a cobrar \(MXN\)/;
const CHARGE_URL = /\/cobro\/[0-9a-f-]{36}$/;
const QR = (page: Page) => page.getByTestId("codi-qr");

/** Inicia sesión y crea un cobro de $150.50 por la interfaz; termina en P03. */
async function openChargeScreen(page: Page, tenant: Tenant, amount = "150.50") {
  await signIn(page, tenant);
  await page.goto("/cobro/confirmar");
  await page.getByLabel(AMOUNT_FIELD).fill(amount);
  await page.getByRole("button", { name: "Confirmar importe" }).click();
  await expect(page).toHaveURL(CHARGE_URL);
  const { charges } = await readCharges(tenant.merchantId!);
  return charges[0];
}

test.describe("P03 — QR y estado «Esperando pago»", () => {
  test("muestra importe, referencia, tiempo restante y las dos acciones", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);

    await expect(page.getByText("Esperando pago")).toBeVisible();
    // Next conserva oculta la pantalla anterior (P02): solo cuenta lo visible.
    await expect(
      page.getByText("$150.50").locator("visible=true"),
    ).toBeVisible();
    await expect(
      page.getByText(`CV-${charge.id.slice(0, 8).toUpperCase()}`),
    ).toBeVisible();
    await expect(page.getByRole("timer")).toContainText(
      /Tiempo restante 0[89]:\d\d/,
    );
    await expect(
      page.getByRole("button", { name: "Consultar nuevamente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cerrar cobro" }),
    ).toBeVisible();
    // P03 no tiene navegación inferior.
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // El QR es de prueba y está rotulado como tal.
    await expect(page.getByText(/QR de prueba/)).toBeVisible();
  });

  test("el QR dibujado se lee con una cámara y contiene exactamente el qrString guardado", async ({
    page,
    tenant,
  }) => {
    await openChargeScreen(page, tenant);
    const { qrs } = await readCharges(tenant.merchantId!);

    const png = await QR(page).screenshot();
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);

    expect(decoded?.data).toBe(qrs[0].qrPayload);
  });

  for (const [width, qrSize] of [
    [320, 232],
    [360, 248],
    [390, 280],
    [430, 280],
  ] as const) {
    test(`a ${width} px el QR se ve completo, sin desbordar ni recortarse`, async ({
      page,
      tenant,
    }) => {
      await page.setViewportSize({ width, height: 740 });
      await openChargeScreen(page, tenant);

      const box = await QR(page).boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.width)).toBe(qrSize);
      expect(Math.round(box!.height)).toBe(qrSize);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      // Botones con objetivo táctil mínimo de 44 px.
      for (const name of ["Consultar nuevamente", "Cerrar cobro"]) {
        const button = await page.getByRole("button", { name }).boundingBox();
        expect(button!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("al recargar o reabrir recupera el mismo cobro desde el backend", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    const url = page.url();

    await page.reload();
    await expect(page.getByText("Esperando pago")).toBeVisible();
    await expect(QR(page)).toBeVisible();

    await page.goto("/inicio");
    await page.goto(url);
    await expect(page.getByText("Esperando pago")).toBeVisible();
    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(1);
    expect(page.url()).toContain(charge.id);
  });

  test("Inicio ofrece retomar el cobro que sigue en curso", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);

    await page.goto("/inicio");

    await expect(page.getByText("Cobro pendiente")).toBeVisible();
    await expect(page.getByText(/no empezar otro/)).toBeVisible();
    await page.getByRole("link", { name: "Retomar cobro" }).click();

    await expect(page).toHaveURL(new RegExp(`/cobro/${charge.id}$`));
    await expect(
      page.getByRole("status").getByText("Esperando pago"),
    ).toBeVisible();
  });
});

test.describe("P03 — el estado sale del backend, nunca de la pantalla", () => {
  test("«Consultar nuevamente» recupera un pago que no llegó por aviso", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant, "13.02");

    await page.getByRole("button", { name: "Consultar nuevamente" }).click();

    await expect(page.getByText("¡Pago recibido!")).toBeVisible();
    const stored = (await readCharges(tenant.merchantId!)).charges.find(
      (row) => row.id === charge.id,
    );
    expect(stored?.status).toBe("paid");
    expect(stored?.paidPaymentId).not.toBeNull();
  });

  test("«Consultar nuevamente» refleja un pago ya persistido", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    await expect(page.getByText(/pago recibido/i)).toHaveCount(0);

    await markChargePaid(charge.id);
    await page.getByRole("button", { name: "Consultar nuevamente" }).click();

    await expect(page.getByText("¡Pago recibido!")).toBeVisible();
    await expect(QR(page)).toHaveCount(0);
    await expect(
      page.getByRole("main").getByRole("link", { name: "Nuevo cobro" }),
    ).toBeVisible();
  });

  test("la consulta periódica actualiza sola la pantalla", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);

    await markChargePaid(charge.id);

    // Consulta cada 5 s: sin tocar nada, aparece el estado persistido.
    await expect(page.getByText("¡Pago recibido!")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("nada en la interfaz puede marcar el cobro como pagado", async ({
    page,
    tenant,
  }) => {
    await openChargeScreen(page, tenant);

    await expect(
      page.getByRole("button", { name: /pagad|ya pag/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /pagad|ya pag/i })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Consultar nuevamente" }).click();
    await expect(page.getByText("Esperando pago")).toBeVisible();
    await expect(page.getByText(/pago recibido/i)).toHaveCount(0);
  });

  test("si no se puede consultar: «Verificación no disponible», el QR sigue y no hay falso rechazo", async ({
    page,
    tenant,
  }) => {
    await openChargeScreen(page, tenant);
    await page.route("**/api/charges/**", (route) => route.abort());

    await page.getByRole("button", { name: "Consultar nuevamente" }).click();

    await expect(page.getByText("Verificación no disponible")).toBeVisible();
    await expect(QR(page)).toBeVisible();
    await expect(page.getByText("Esperando pago")).toBeVisible();
    await expect(page.getByText(/expirado|rechazado/i)).toHaveCount(0);

    await page.unroute("**/api/charges/**");
    await page.getByRole("button", { name: "Consultar nuevamente" }).click();
    await expect(page.getByText("Verificación no disponible")).toHaveCount(0);
  });

  test("con la sesión vencida, A01 y de regreso al cobro", async ({
    page,
    context,
    tenant,
  }) => {
    await openChargeScreen(page, tenant);
    const path = new URL(page.url()).pathname;

    await context.clearCookies();
    await page.getByRole("button", { name: "Consultar nuevamente" }).click();

    await expect(page).toHaveURL(/\/acceso\?motivo=sesion-expirada/);
    expect(decodeURIComponent(page.url())).toContain(`siguiente=${path}`);
  });
});

test.describe("P03 — expiración", () => {
  test("al vencer, el servidor lo confirma: «Cobro expirado», sin QR, sin perder el registro", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);

    await setChargeExpiry(charge.id, new Date(Date.now() - 1_000));
    await page.getByRole("button", { name: "Consultar nuevamente" }).click();

    await expect(page.getByText("Cobro expirado")).toBeVisible();
    await expect(
      page.getByText(/no significa que el pago se haya rechazado/),
    ).toBeVisible();
    await expect(QR(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cerrar cobro" }),
    ).toHaveCount(0);

    const { charges, qrs } = await readCharges(tenant.merchantId!);
    expect(charges[0].status).toBe("expired");
    expect(charges[0].closedAt).toBeNull();
    // El QR queda registrado: un pago tardío todavía podrá conciliarse (PR-07).
    expect(qrs).toHaveLength(1);

    await page.reload();
    await expect(page.getByText("Cobro expirado")).toBeVisible();
  });

  test("al agotarse el tiempo en pantalla, la consulta automática trae el estado vencido", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);

    // Faltan ~3 s: la cuenta regresiva llega a cero y se pide el estado al servidor.
    await setChargeExpiry(charge.id, new Date(Date.now() + 3_000));
    await page.getByRole("button", { name: "Consultar nuevamente" }).click();
    await expect(page.getByRole("timer")).toContainText("00:0");

    await expect(page.getByText("Cobro expirado")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("«Nuevo cobro» desde un cobro vencido lleva a Inicio sin reutilizar el anterior", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    await setChargeExpiry(charge.id, new Date(Date.now() - 1_000));
    await page.reload();

    await page
      .getByRole("main")
      .getByRole("link", { name: "Nuevo cobro" })
      .click();

    await expect(page).toHaveURL(/\/inicio$/);
    expect((await readCharges(tenant.merchantId!)).charges).toHaveLength(1);
  });
});

test.describe("P03 — cerrar cobro (cierre local)", () => {
  test("pide confirmación y aclara que no cancela el pago bancario; «Volver» no cambia nada", async ({
    page,
    tenant,
  }) => {
    await openChargeScreen(page, tenant);

    await page.getByRole("button", { name: "Cerrar cobro" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        "Se cerrará en CobraVoz, pero esto no cancela un pago en el banco.",
      ),
    ).toBeVisible();
    // El foco inicial está en la opción segura.
    await expect(dialog.getByRole("button", { name: "Volver" })).toBeFocused();

    await dialog.getByRole("button", { name: "Volver" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Esperando pago")).toBeVisible();
    expect((await readCharges(tenant.merchantId!)).charges[0].status).toBe(
      "waiting_payment",
    );

    // Escape también descarta.
    await page.getByRole("button", { name: "Cerrar cobro" }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("confirmar cierra el cobro: locally_closed, QR y registro intactos, persiste al recargar", async ({
    page,
    tenant,
  }) => {
    await openChargeScreen(page, tenant);

    await page.getByRole("button", { name: "Cerrar cobro" }).click();
    await page.getByRole("button", { name: "Sí, cerrar cobro" }).click();

    await expect(page.getByText("Cobro cerrado")).toBeVisible();
    await expect(
      page.getByText(
        "Solo se cerró en CobraVoz; no cancela un pago en el banco.",
      ),
    ).toBeVisible();
    await expect(QR(page)).toHaveCount(0);
    await expect(
      page.getByRole("main").getByRole("link", { name: "Volver a Inicio" }),
    ).toBeVisible();

    const { charges, qrs } = await readCharges(tenant.merchantId!);
    expect(charges[0].status).toBe("locally_closed");
    expect(charges[0].closedAt).not.toBeNull();
    expect(qrs).toHaveLength(1);

    await page.reload();
    await expect(page.getByText("Cobro cerrado")).toBeVisible();
  });

  test("un cobro cerrado puede seguir recibiendo un pago tardío (se refleja desde el backend)", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    await page.getByRole("button", { name: "Cerrar cobro" }).click();
    await page.getByRole("button", { name: "Sí, cerrar cobro" }).click();
    await expect(page.getByText("Cobro cerrado")).toBeVisible();

    await markChargePaid(charge.id);
    await page.reload();

    await expect(page.getByText("¡Pago recibido!")).toBeVisible();
  });

  test("si el pago llegó mientras la pantalla seguía abierta, cerrar NO lo pisa", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    await markChargePaid(charge.id);

    // La pantalla aún muestra «Esperando pago»; la persona intenta cerrar.
    await page.getByRole("button", { name: "Cerrar cobro" }).click();
    await page.getByRole("button", { name: "Sí, cerrar cobro" }).click();

    await expect(page.getByText("¡Pago recibido!")).toBeVisible();
    await expect(page.getByText("Cobro cerrado")).toHaveCount(0);
    expect((await readCharges(tenant.merchantId!)).charges[0].status).toBe(
      "paid",
    );
  });

  test("si falla la red al cerrar, no se cierra nada y se explica", async ({
    page,
    tenant,
  }) => {
    await openChargeScreen(page, tenant);
    await page.route("**/api/charges/*/close", (route) => route.abort());

    await page.getByRole("button", { name: "Cerrar cobro" }).click();
    await page.getByRole("button", { name: "Sí, cerrar cobro" }).click();

    await expect(page.getByText("No se cerró el cobro")).toBeVisible();
    await expect(QR(page)).toBeVisible();
    expect((await readCharges(tenant.merchantId!)).charges[0].status).toBe(
      "waiting_payment",
    );
  });
});

test.describe("P03 — estados sin QR", () => {
  test("«Generando QR» no muestra ningún código; si queda sin resolver pasa a QR incierto", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    const id = await insertCreatedCharge(tenant.merchantId!);

    await page.goto(`/cobro/${id}`);
    await expect(page.getByText("Generando QR")).toBeVisible();
    await expect(QR(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /cerrar|consultar/i }),
    ).toHaveCount(0);

    // Un cobro «antiguo» sin resolver: no se vuelve a pedir un QR, se marca incierto.
    const stale = await insertCreatedCharge(tenant.merchantId!, {
      createdAt: new Date(Date.now() - 5 * 60_000),
    });
    await page.goto(`/cobro/${stale}`);
    await expect(page.getByText("No pudimos confirmar el QR")).toBeVisible();
    await expect(QR(page)).toHaveCount(0);

    const { charges, incidents, qrs } = await readCharges(tenant.merchantId!);
    expect(charges.find((c) => c.id === stale)?.status).toBe("qr_uncertain");
    expect(incidents).toHaveLength(1);
    expect(qrs).toHaveLength(0);
  });

  test("el QR incierto ofrece volver a Inicio, nunca otro QR", async ({
    page,
    tenant,
  }) => {
    await openChargeScreen(page, tenant, "13.01");

    await expect(page.getByText("No pudimos confirmar el QR")).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "Volver a Inicio" }),
    ).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
  });
});

test.describe("P03 — acceso", () => {
  test("un cobro ajeno o un id inválido se ven igual: «No encontramos ese cobro»", async ({
    browser,
    tenant,
    otherTenant,
  }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const charge = await openChargeScreen(owner, tenant);
    const reference = `CV-${charge.id.slice(0, 8).toUpperCase()}`;

    const intruderContext = await browser.newContext();
    const intruder = await intruderContext.newPage();
    await signIn(intruder, otherTenant);

    for (const target of [charge.id, "no-es-un-uuid", crypto.randomUUID()]) {
      await intruder.goto(`/cobro/${target}`);
      await expect(
        intruder.getByText("No encontramos ese cobro"),
      ).toBeVisible();
      await expect(intruder.getByTestId("codi-qr")).toHaveCount(0);
      await expect(intruder.getByText(reference)).toHaveCount(0);
    }

    await ownerContext.close();
    await intruderContext.close();
  });

  plain(
    "sin sesión redirige a A01 conservando el destino",
    async ({ page }) => {
      const id = crypto.randomUUID();

      await page.goto(`/cobro/${id}`);

      await expect(page).toHaveURL(/\/acceso/);
      expect(decodeURIComponent(page.url())).toContain(
        `siguiente=/cobro/${id}`,
      );
    },
  );
});

test.describe("API POST /api/charges/:id/close", () => {
  plain("sin sesión responde 401", async ({ request }) => {
    const response = await request.post(
      `/api/charges/${crypto.randomUUID()}/close`,
      {
        headers: SAME_ORIGIN,
      },
    );
    expect(response.status()).toBe(401);
  });

  test("sin Origin o con Origen ajeno se rechaza (403) y no cierra nada", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    const url = `/api/charges/${charge.id}/close`;

    const sinOrigin = await page.request.post(url);
    const ajeno = await page.request.post(url, {
      headers: { Origin: "https://evil.example" },
    });

    expect(sinOrigin.status()).toBe(403);
    expect(ajeno.status()).toBe(403);
    expect((await readCharges(tenant.merchantId!)).charges[0].status).toBe(
      "waiting_payment",
    );
  });

  test("cierra (200), es idempotente y devuelve el cobro con serverTime y sin caché", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    const url = `/api/charges/${charge.id}/close`;

    const first = await page.request.post(url, { headers: SAME_ORIGIN });
    const second = await page.request.post(url, { headers: SAME_ORIGIN });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(first.headers()["cache-control"]).toContain("no-store");
    const a = await first.json();
    const b = await second.json();
    expect(a.charge.status).toBe("locally_closed");
    expect(b.charge.closedAt).toBe(a.charge.closedAt);
    expect(Number.isNaN(Date.parse(a.serverTime))).toBe(false);
    expect(JSON.stringify(a)).not.toMatch(/merchantId|numRef|peyQrId|mock-qr-/);
  });

  test("un cobro vencido responde 409 con su estado real", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    await setChargeExpiry(charge.id, new Date(Date.now() - 1_000));

    const response = await page.request.post(
      `/api/charges/${charge.id}/close`,
      {
        headers: SAME_ORIGIN,
      },
    );

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("not_closable");
    expect(body.charge.status).toBe("expired");
  });

  test("cobro ajeno, inexistente o mal formado: 404 y no se modifica", async ({
    browser,
    tenant,
    otherTenant,
  }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const charge = await openChargeScreen(owner, tenant);

    const intruderContext = await browser.newContext();
    const intruder = await intruderContext.newPage();
    await signIn(intruder, otherTenant);

    for (const target of [charge.id, crypto.randomUUID(), "no-es-uuid"]) {
      const response = await intruder.request.post(
        `/api/charges/${target}/close`,
        {
          headers: SAME_ORIGIN,
        },
      );
      expect(response.status()).toBe(404);
      expect((await response.json()).error.code).toBe("not_found");
    }
    expect((await readCharges(tenant.merchantId!)).charges[0].status).toBe(
      "waiting_payment",
    );

    await ownerContext.close();
    await intruderContext.close();
  });

  test("GET aplica el vencimiento por tiempo y devuelve la hora del servidor", async ({
    page,
    tenant,
  }) => {
    const charge = await openChargeScreen(page, tenant);
    await setChargeExpiry(charge.id, new Date(Date.now() - 1_000));

    const response = await page.request.get(`/api/charges/${charge.id}`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.charge.status).toBe("expired");
    expect(Number.isNaN(Date.parse(body.serverTime))).toBe(false);
  });
});
