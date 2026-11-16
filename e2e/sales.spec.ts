import { expect, signIn, test } from "./support/fixtures";
import { markChargePaid, readCharges } from "./support/tenants";

const AMOUNT_FIELD = /Importe a cobrar \(MXN\)/;

test.describe("P04 Ventas y A03 Detalle", () => {
  test("el total de hoy ignora un cobro pendiente y cuenta el pago conciliado", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);

    await expect(page.getByText("Total cobrado hoy")).toBeVisible();
    await expect(page.getByText("$0.00").first()).toBeVisible();
    await expect(page.getByText("0 pagos confirmados").first()).toBeVisible();
    await expect(page.getByText("Aún no tienes movimientos.")).toBeVisible();

    await page.getByRole("link", { name: "Ingresar importe manualmente" }).click();
    await page.getByLabel(AMOUNT_FIELD).fill("150.50");
    await page.getByRole("button", { name: "Confirmar importe" }).click();
    await expect(page).toHaveURL(/\/cobro\/[0-9a-f-]{36}$/);

    await page.goto("/ventas");
    await expect(page.getByRole("heading", { name: "Ventas" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Resumen de hoy" })).toContainText(
      "$0.00",
    );
    await expect(page.getByText("Esperando pago")).toBeVisible();

    const charge = (await readCharges(tenant.merchantId!)).charges[0];
    await markChargePaid(charge.id);
    await page.reload();

    const summary = page.getByRole("region", { name: "Resumen de hoy" });
    await expect(summary).toContainText("$150.50");
    await expect(summary).toContainText("1 pago confirmado");
    await page.getByRole("link", { name: /CV-/ }).click();

    await expect(page.getByRole("heading", { name: "Detalle" })).toBeVisible();
    const detail = page.getByRole("main");
    await expect(detail.getByText("Pagado")).toBeVisible();
    await expect(detail.getByText("Importe solicitado")).toBeVisible();
    await expect(detail.getByText("Importe recibido")).toBeVisible();
    await expect(detail.getByText("CoDi")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /pagad|marcar/i }),
    ).toHaveCount(0);
  });

  test("Inicio y Ventas comparten la barra; P02 no la tiene", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    await expect(
      page.getByRole("navigation", { name: "Principal" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Ventas" }).click();
    await expect(page.getByRole("link", { name: "Ventas" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.goto("/cobro/confirmar");
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
});
