/**
 * Falla si algún secreto de servidor aparece en lo que se envía al navegador
 * (`.next/static`) o en los archivos públicos (`public/`).
 *
 * Busca los VALORES reales de las variables privadas (desde el entorno o
 * `.env.local`), así detecta una fuga aunque cambie el nombre de la variable.
 * Uso: npm run build && npm run check:bundle
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables del entorno.
}

const PRIVATE_NAMES = [
  "SUPABASE_SECRET_KEY",
  "DATABASE_URL",
  "DATABASE_MIGRATION_URL",
  "PEY_API_KEY",
  "PEY_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "CRON_SECRET",
];
// Evita falsos positivos con valores triviales (p. ej. «postgres», vacío).
const MIN_SECRET_LENGTH = 12;

const secrets = [];
for (const [name, value] of Object.entries(process.env)) {
  const isPrivate =
    PRIVATE_NAMES.includes(name) ||
    (/(SECRET|PRIVATE|API_KEY|PASSWORD|TOKEN)/.test(name) &&
      !name.startsWith("NEXT_PUBLIC_"));
  if (isPrivate && value && value.length >= MIN_SECRET_LENGTH) {
    secrets.push({ name, value });
  }
}

function* walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const targets = [".next/static", "public"];
const files = targets.flatMap((target) => [...walk(target)]);
if (!files.some((file) => file.startsWith(".next/static"))) {
  console.error("No existe .next/static: ejecuta `npm run build` primero.");
  process.exit(2);
}

const leaks = [];
for (const file of files) {
  const content = readFileSync(file).toString("latin1");
  for (const { name, value } of secrets) {
    if (content.includes(value)) leaks.push({ file, name });
  }
}

if (leaks.length > 0) {
  console.error("✗ Secretos de servidor encontrados en archivos públicos:");
  for (const { file, name } of leaks) console.error(`  - ${name} en ${file}`);
  process.exit(1);
}

console.log(
  `✓ Sin secretos en el cliente (${secrets.length} valores revisados en ${files.length} archivos).`,
);
