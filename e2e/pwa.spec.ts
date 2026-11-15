import { expect, test } from "@playwright/test";

test.describe("PWA mínima", () => {
  test("expone un manifest válido y usable para instalar", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: "CobraVoz",
      lang: "es-MX",
      display: "standalone",
      start_url: "/inicio",
      theme_color: "#107B75",
    });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );

    for (const icon of manifest.icons as { src: string }[]) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok(), icon.src).toBe(true);
    }
  });

  test("el service worker se sirve sin caché", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("sin red, una navegación muestra la página informativa", async ({
    page,
    context,
  }) => {
    await page.goto("/inicio");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Garantiza que el SW controla la página antes de cortar la red.
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    await context.setOffline(true);
    await page.goto("/inicio").catch(() => {});

    await expect(
      page.getByRole("heading", { name: "No podemos generar un cobro nuevo." }),
    ).toBeVisible();
    await context.setOffline(false);
  });

  test("la página sin conexión informa y no permite cobrar", async ({
    page,
  }) => {
    await page.goto("/offline.html");
    await expect(
      page.getByRole("heading", {
        name: "No podemos generar un cobro nuevo.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reintentar" }),
    ).toBeVisible();
  });
});
