import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias `@/*` definido en tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // `*.db.test.ts` necesita Postgres local: ver `npm run test:db`.
    exclude: ["node_modules/**", ".next/**", "e2e/**", "**/*.db.test.ts"],
    restoreMocks: true,
  },
});
