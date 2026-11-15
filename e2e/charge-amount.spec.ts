import { test as plain } from "@playwright/test";
import { expect, signIn, test } from "./support/fixtures";

const AMOUNT_FIELD = /Importe a cobrar \(MXN\)/;

test.describe("P01 Inicio → captura manual", () => {
  test("muestra la voz como acción dominante y la captura manual siempre a mano", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);

    const mic = page.getByRole("button", { name: "Hablar para cobrar" });
    await expect(mic).toBeVisible();
    // Aún sin STT: el control está inhabilitado y se explica por qué.
    await expect(mic).toBeDisabled();
    await expect(
      page.getByText(/captura por voz no está disponible/i),
    ).toBeVisible();

    const box = await mic.boundingBox();
    expect(box?.width).toBe(112);
    expect(box?.height).toBe(112);

    await expect(
      page.getByRole("link", { name: "Ingresar importe manualmente" }),
    ).toBeVisible();
    // Navegación inferior, resumen y movimientos pertenecen a PR posteriores.
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("«Ingresar importe manualmente» abre P02 con el campo enfocado", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await page
      .getByRole("link", { name: "Ingresar importe manualmente" })
      .click();

    await expect(page).toHaveURL(/\/cobro\/confirmar$/);
    await expect(page.getByLabel(AMOUNT_FIELD)).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Confirmar importe" }),
    ).toBeDisabled();
    // P02 no lleva barra de navegación inferior (UX §2).
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
});

test.describe("P02 Confirmación del importe", () => {
  test.beforeEach(async ({ page, tenant }) => {
    await signIn(page, tenant);
    await page.goto("/cobro/confirmar");
  });

  test("el importe se ve grande al escribir y no se confirma solo", async ({
    page,
  }) => {
    await page.getByLabel(AMOUNT_FIELD).fill("1500.5");

    await expect(page.getByText("$1,500.50", { exact: true })).toBeVisible();
    await expect(page.getByText(/Importe confirmado/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Confirmar importe" }),
    ).toBeEnabled();
  });

  for (const [typed, message] of [
    ["10.123", /máximo dos decimales/i],
    ["0", /mayor que \$0\.00/i],
    ["abc", /solo números/i],
    ["150,50", /usa punto/i],
  ] as const) {
    test(`«${typed}» muestra un error claro y no permite confirmar`, async ({
      page,
    }) => {
      await page.getByLabel(AMOUNT_FIELD).fill(typed);

      await expect(page.getByText(message)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Confirmar importe" }),
      ).toBeDisabled();
    });
  }

  test("Cancelar y Volver regresan a Inicio", async ({ page }) => {
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page).toHaveURL(/\/inicio$/);

    await page.goto("/cobro/confirmar");
    await page.getByRole("link", { name: "Volver a Inicio" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
  });

  test("con ?centavos precarga el importe y exige confirmar; Corregir reabre el campo", async ({
    page,
  }) => {
    await page.goto("/cobro/confirmar?centavos=15050");

    await expect(page.getByText("$150.50", { exact: true })).toBeVisible();
    await expect(page.getByLabel(AMOUNT_FIELD)).toHaveCount(0);
    await expect(page.getByText(/Importe confirmado/)).toHaveCount(0);

    await page.getByRole("button", { name: "Corregir importe" }).click();
    const field = page.getByLabel(AMOUNT_FIELD);
    await expect(field).toHaveValue("150.50");
    await field.fill("200");
    await expect(page.getByText("$200.00", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar importe" }).click();
    // Con el importe corregido y confirmado, P03 muestra ESE importe.
    await expect(page).toHaveURL(/\/cobro\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Esperando pago")).toBeVisible();
    await expect(
      page.getByRole("main").locator("visible=true").getByText("$200.00"),
    ).toBeVisible();
  });

  for (const bad of ["abc", "0", "-5", "1.5", "999999999999", "100000000"]) {
    test(`?centavos=${bad} se ignora y abre la captura manual vacía`, async ({
      page,
    }) => {
      await page.goto(`/cobro/confirmar?centavos=${bad}`);

      await expect(page.getByLabel(AMOUNT_FIELD)).toHaveValue("");
      await expect(
        page.getByRole("button", { name: "Confirmar importe" }),
      ).toBeDisabled();
    });
  }
});

test.describe("Protección de P02", () => {
  plain(
    "sin sesión redirige a A01 conservando el destino",
    async ({ page }) => {
      await page.goto("/cobro/confirmar?centavos=15050");
      await expect(page).toHaveURL(
        /\/acceso\?siguiente=%2Fcobro%2Fconfirmar%3Fcentavos%3D15050$/,
      );
    },
  );

  test("tras iniciar sesión vuelve a P02 con el importe", async ({
    page,
    tenant,
  }) => {
    await page.goto("/cobro/confirmar?centavos=15050");
    await page.getByLabel("Correo electrónico").fill(tenant.email);
    await page.getByLabel("Contraseña").fill(tenant.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/cobro\/confirmar\?centavos=15050$/);
    await expect(page.getByText("$150.50", { exact: true })).toBeVisible();
  });

  test("las respuestas privadas no se almacenan en caché", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    const response = await page.goto("/cobro/confirmar");
    expect(response?.headers()["cache-control"] ?? "").toMatch(
      /no-store|private/,
    );
  });
});
