/**
 * Genera `.env.local` con los valores de Supabase local (`supabase status`).
 * No sobrescribe un archivo existente salvo con `--force`. `.env.local` está
 * ignorado por git: las claves locales nunca se commitean.
 *
 * Uso: npm run db:env
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

const FILE = ".env.local";
const force = process.argv.includes("--force");

if (existsSync(FILE) && !force) {
  console.log(`${FILE} ya existe; usa --force para regenerarlo.`);
  process.exit(0);
}

const raw = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});

const status = Object.fromEntries(
  raw
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);

for (const key of ["API_URL", "DB_URL", "PUBLISHABLE_KEY", "SECRET_KEY"]) {
  if (!status[key]) {
    console.error(
      `Falta ${key} en 'supabase status'. ¿Está corriendo (npm run db:start)?`,
    );
    process.exit(1);
  }
}

writeFileSync(
  FILE,
  [
    "# Generado por `npm run db:env` — solo desarrollo local, NO commitear.",
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "NEXT_PUBLIC_APP_ENV=local",
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${status.SECRET_KEY}`,
    `DATABASE_URL=${status.DB_URL}`,
    `DATABASE_MIGRATION_URL=${status.DB_URL}`,
    "",
  ].join("\n"),
);
console.log(`✓ ${FILE} generado con la configuración de Supabase local.`);
