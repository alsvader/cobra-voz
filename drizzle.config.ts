import { defineConfig } from "drizzle-kit";

// Lo que ya venga en el entorno (el comando) gana sobre `.env.local`.
// Dentro del archivo, si la misma clave está repetida, Node se queda con
// la última línea: una URL de producción escrita arriba de la local se ignora.
const shellMigrationUrl = process.env.DATABASE_MIGRATION_URL;
const shellDatabaseUrl = process.env.DATABASE_URL;

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en el entorno (CI, Vercel).
}

const url =
  shellMigrationUrl ||
  process.env.DATABASE_MIGRATION_URL ||
  shellDatabaseUrl ||
  process.env.DATABASE_URL ||
  "";

function migrationTarget(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "URL inválida";
  }
}

console.log(`Migraciones contra ${migrationTarget(url)}`);

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
