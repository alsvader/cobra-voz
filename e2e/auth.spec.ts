import { test as plain } from "@playwright/test";
import {
  authCookieName,
  expect,
  login,
  signIn,
  test,
} from "./support/fixtures";
import {
  createTenant,
  deleteTenant,
  readVoiceAnnouncements,
} from "./support/tenants";

const ORIGIN = `http://localhost:${process.env.PORT ?? 3100}`;
const SAME_ORIGIN = { Origin: ORIGIN };

test.describe("Acceso (A01)", () => {
  test("muestra el formulario con el CTA principal", async ({ page }) => {
    await page.goto("/acceso");

    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(
      page.getByText("Cobra fácilmente, sin dejar de atender tu negocio."),
    ).toBeVisible();
    const cta = page.getByRole("button", { name: "Iniciar sesión" });
    expect((await cta.boundingBox())?.height).toBe(56);
  });

  test("entra con credenciales válidas y muestra el comercio", async ({
    page,
    tenant,
  }) => {
    await login(page, tenant);

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByText(tenant.merchantName!)).toBeVisible();
  });

  test("con contraseña incorrecta explica el problema y no abre sesión", async ({
    page,
    tenant,
  }) => {
    await login(page, { email: tenant.email, password: "incorrecta" });

    await expect(
      page.getByText(/correo o contraseña incorrectos/i),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/acceso/);
    // Conserva el correo para no obligar a reescribirlo.
    await expect(page.getByLabel("Correo electrónico")).toHaveValue(
      tenant.email,
    );

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/acceso/);
  });

  test("un usuario sin comercio no entra y queda sin sesión", async ({
    page,
  }) => {
    const orphan = await createTenant({ withMerchant: false });
    try {
      await login(page, orphan);

      await expect(
        page.getByText(/todavía no tiene un comercio asignado/i),
      ).toBeVisible();
      await page.goto("/inicio");
      await expect(page).toHaveURL(/\/acceso/);
    } finally {
      await deleteTenant(orphan);
    }
  });

  test("regresa a la ruta pedida tras iniciar sesión", async ({
    page,
    tenant,
  }) => {
    await page.goto("/configuracion");
    await expect(page).toHaveURL(/\/acceso\?siguiente=%2Fconfiguracion/);

    await page.getByLabel("Correo electrónico").fill(tenant.email);
    await page.getByLabel("Contraseña").fill(tenant.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/configuracion$/);
  });

  test("ignora destinos externos en «siguiente» (open redirect)", async ({
    page,
    tenant,
  }) => {
    await page.goto("/acceso?siguiente=https%3A%2F%2Fevil.example%2F");
    await page.getByLabel("Correo electrónico").fill(tenant.email);
    await page.getByLabel("Contraseña").fill(tenant.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/inicio$/);
  });
});

test.describe("Protección de rutas", () => {
  test("sin sesión, /inicio y /configuracion redirigen a A01", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/acceso\?siguiente=%2Finicio$/);

    await page.goto("/configuracion");
    await expect(page).toHaveURL(/\/acceso\?siguiente=%2Fconfiguracion$/);
  });

  test("una cookie de sesión alterada se trata como sesión expirada", async ({
    page,
    context,
    tenant,
  }) => {
    await login(page, tenant);
    await expect(page).toHaveURL(/\/inicio$/);

    const cookies = await context.cookies();
    const session = cookies.filter((c) => c.name.startsWith(authCookieName()));
    expect(session.length).toBeGreaterThan(0);
    await context.clearCookies();
    await context.addCookies(
      session.map((c, index) => ({
        ...c,
        value: index === 0 ? "base64-invalido" : c.value,
      })),
    );

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/acceso\?motivo=sesion-expirada/);
    await expect(page.getByText(/tu sesión expiró/i)).toBeVisible();
  });

  test("las páginas privadas no se almacenan en caché", async ({
    page,
    tenant,
  }) => {
    await login(page, tenant);
    const response = await page.goto("/inicio");

    expect(response?.headers()["cache-control"] ?? "").toMatch(
      /no-store|private/,
    );
  });
});

test.describe("API /api/preferences", () => {
  plain("sin sesión responde 401 y no se cachea", async ({ request }) => {
    const response = await request.get("/api/preferences");

    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toMatchObject({
      error: { code: "unauthenticated" },
    });
  });

  plain("sin sesión rechaza también PATCH", async ({ request }) => {
    const response = await request.patch("/api/preferences", {
      headers: SAME_ORIGIN,
      data: { voiceAnnouncementsEnabled: false },
    });

    expect(response.status()).toBe(401);
  });

  test("con sesión devuelve las preferencias del comercio", async ({
    page,
    tenant,
  }) => {
    await login(page, tenant);
    await expect(page).toHaveURL(/\/inicio$/);

    const response = await page.request.get("/api/preferences");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ voiceAnnouncementsEnabled: true });
  });

  test("PATCH sin Origin o con Origin ajeno se rechaza (403) y no cambia nada", async ({
    page,
    tenant,
  }) => {
    await login(page, tenant);
    await expect(page).toHaveURL(/\/inicio$/);
    const data = { voiceAnnouncementsEnabled: false };

    const sinOrigin = await page.request.patch("/api/preferences", { data });
    const ajeno = await page.request.patch("/api/preferences", {
      data,
      headers: { Origin: "https://evil.example" },
    });

    expect(sinOrigin.status()).toBe(403);
    expect(ajeno.status()).toBe(403);
    expect(await readVoiceAnnouncements(tenant.merchantId!)).toBe(true);
  });

  test("PATCH del mismo origen persiste el cambio", async ({
    page,
    tenant,
  }) => {
    await login(page, tenant);
    await expect(page).toHaveURL(/\/inicio$/);

    const response = await page.request.patch("/api/preferences", {
      headers: SAME_ORIGIN,
      data: { voiceAnnouncementsEnabled: false },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ voiceAnnouncementsEnabled: false });
    expect(await readVoiceAnnouncements(tenant.merchantId!)).toBe(false);
  });

  test("rechaza campos extra como merchantId (400) sin tocar a otro comercio", async ({
    page,
    tenant,
    otherTenant,
  }) => {
    await login(page, tenant);
    await expect(page).toHaveURL(/\/inicio$/);

    const response = await page.request.patch("/api/preferences", {
      headers: SAME_ORIGIN,
      data: {
        voiceAnnouncementsEnabled: false,
        merchantId: otherTenant.merchantId,
      },
    });

    expect(response.status()).toBe(400);
    expect(await readVoiceAnnouncements(otherTenant.merchantId!)).toBe(true);
    expect(await readVoiceAnnouncements(tenant.merchantId!)).toBe(true);
  });

  test("un comercio no puede leer ni alterar el de otro", async ({
    page,
    tenant,
    otherTenant,
  }) => {
    await login(page, tenant);
    await expect(page).toHaveURL(/\/inicio$/);

    const update = await page.request.patch("/api/preferences", {
      headers: SAME_ORIGIN,
      data: { voiceAnnouncementsEnabled: false },
    });

    expect(update.status()).toBe(200);
    expect(await readVoiceAnnouncements(tenant.merchantId!)).toBe(false);
    expect(await readVoiceAnnouncements(otherTenant.merchantId!)).toBe(true);
  });

  test("cuerpo inválido responde 400", async ({ page, tenant }) => {
    await login(page, tenant);
    await expect(page).toHaveURL(/\/inicio$/);

    const response = await page.request.patch("/api/preferences", {
      headers: SAME_ORIGIN,
      data: { voiceAnnouncementsEnabled: "si" },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe("Configuración (A02) y cierre de sesión", () => {
  test("muestra datos de solo lectura y el interruptor persiste", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.getByRole("link", { name: "Configuración" }).click();

    await expect(page).toHaveURL(/\/configuracion$/);
    await expect(
      page.locator("dd", { hasText: tenant.merchantName! }),
    ).toBeVisible();
    await expect(page.locator("dd", { hasText: /^Cuenta / })).toBeVisible();
    // Los datos del comercio no son editables.
    await expect(page.getByRole("textbox")).toHaveCount(0);

    const toggle = page.getByRole("switch", { name: "Anunciar pagos" });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect
      .poll(() => readVoiceAnnouncements(tenant.merchantId!))
      .toBe(false);

    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Anunciar pagos" }),
    ).not.toBeChecked();
  });

  test("si no se puede guardar, revierte el interruptor y avisa", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/configuracion");
    await page.route("**/api/preferences", (route) =>
      route.request().method() === "PATCH" ? route.abort() : route.continue(),
    );

    const toggle = page.getByRole("switch", { name: "Anunciar pagos" });
    await toggle.click();

    await expect(
      page.getByText(/no pudimos guardar tu preferencia/i),
    ).toBeVisible();
    await expect(toggle).toBeChecked();
  });

  test("cerrar sesión devuelve a A01 y bloquea las rutas privadas", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/configuracion");

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/acceso$/);

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/acceso\?siguiente=%2Finicio$/);
    const api = await page.request.get("/api/preferences");
    expect(api.status()).toBe(401);
  });

  test("el botón Atrás tras cerrar sesión no muestra datos privados", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page.goto("/configuracion");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/acceso$/);

    await page.goBack();
    await page.reload();

    await expect(page).toHaveURL(/\/acceso/);
    await expect(page.getByText(tenant.merchantName!)).toHaveCount(0);
  });
});
