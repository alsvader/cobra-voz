import { expect, test } from "@playwright/test";
import { signIn, test as authTest } from "./support/fixtures";

const WIDTHS = [320, 360, 390, 430] as const;
const ROUTES = ["/", "/acceso", "/offline.html"] as const;

test.describe("Layout móvil (DESIGN.md §12)", () => {
  for (const width of WIDTHS) {
    for (const route of ROUTES) {
      test(`sin overflow horizontal en ${route} a ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }

  test("la app usa DM Sans y el fondo canvas del sistema de diseño", async ({
    page,
  }) => {
    await page.goto("/acceso");

    const styles = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      return { background: body.backgroundColor, font: body.fontFamily };
    });
    expect(styles.background).toBe("rgb(246, 248, 245)"); // #F6F8F5
    expect(styles.font.toLowerCase()).toContain("dm sans");
  });

  test("el CTA principal mide 56px de alto", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Entrar a la aplicación" });
    const box = await cta.boundingBox();
    expect(box?.height).toBe(56);
  });
});

authTest.describe("Layout móvil de pantallas con sesión", () => {
  for (const width of WIDTHS) {
    authTest(
      `sin overflow en /inicio y /configuracion a ${width}px`,
      async ({ page, tenant }) => {
        await page.setViewportSize({ width, height: 800 });
        await signIn(page, tenant);
        await expect(page).toHaveURL(/\/inicio$/);

        for (const route of ["/inicio", "/configuracion"]) {
          await page.goto(route);
          await expect(page.getByText(tenant.merchantName!)).toBeVisible();
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );
          expect(overflow, route).toBeLessThanOrEqual(0);
        }
      },
    );
  }
});
