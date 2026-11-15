import { defineConfig } from "drizzle-kit";

// drizzle-kit no carga `.env.local` por sí mismo (Node ≥ 22 lo permite).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en el entorno (CI, Vercel).
}

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./adapters/db/schema/index.ts",
  out: "./drizzle",
  // Solo `public`: `auth` pertenece a Supabase y no se gestiona desde aquí.
  schemaFilter: ["public"],
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: true,
});
