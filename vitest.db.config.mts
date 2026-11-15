import { defineConfig } from "vitest/config";

/**
 * Pruebas de integración contra Postgres LOCAL (Supabase local).
 * Requiere `npm run db:start` y `npm run db:migrate`. Se ejecutan con
 * `npm run test:db` y no forman parte de `npm run test`.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    setupFiles: ["./vitest.db.setup.ts"],
    include: ["**/*.db.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    // Las pruebas comparten una sola base de datos.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
