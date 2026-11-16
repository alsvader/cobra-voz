import { defineConfig, devices } from "@playwright/test";
import { webhookSecret } from "./e2e/support/webhook";

// Las pruebas con sesión usan Supabase local: se cargan sus variables (.env.local).
try {
  process.loadEnvFile(".env.local");
} catch {
  // En CI las variables llegan por el entorno.
}

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E contra el build de producción (`next build && next start`), que es lo
 * más parecido a lo que se desplegará. Ver `npm run e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "es-MX",
  },
  projects: [
    // Android Chrome (360×800 aprox.)
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    // Safari iOS: requiere `npx playwright install webkit`.
    ...(process.env.E2E_WEBKIT
      ? [{ name: "webkit-mobile", use: { ...devices["iPhone 14"] } }]
      : []),
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      PEY_WEBHOOK_SECRET: webhookSecret(),
    },
  },
});
