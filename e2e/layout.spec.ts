import { expect, test } from "@playwright/test";

const WIDTHS = [320, 360, 390, 430] as const;
const ROUTES = ["/", "/inicio", "/offline.html"] as const;

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
    await page.goto("/inicio");

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
