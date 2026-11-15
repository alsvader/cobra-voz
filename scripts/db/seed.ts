/**
 * Seed CONTROLADO para desarrollo local.
 *
 * Crea el comerciante demo, sus preferencias y un usuario de Auth ligado a él
 * (no existe registro público). Es idempotente y se NIEGA a correr si la base
 * de datos, Supabase o el entorno no son locales: nunca debe tocar Preview ni
 * Producción.
 *
 * Uso: npm run db:seed
 */
import { createDb } from "../../adapters/db/create-db";
import {
  merchantPreferences,
  merchants,
  merchantUsers,
} from "../../adapters/db/schema";
import { ensureAuthUser, readAuthAdminConfig } from "./auth-admin";
import { assertLocalDatabase } from "./local-guard";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables del entorno.
}

/** Identificador fijo para poder re-ejecutar el seed sin duplicar. */
export const DEMO_MERCHANT_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_EMAIL = process.env.SEED_USER_EMAIL ?? "demo@cobravoz.local";
// Contraseña solo para desarrollo local; nunca usar este valor fuera de local.
const DEMO_PASSWORD = process.env.SEED_USER_PASSWORD ?? "cobravoz-local-dev";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta ${name}. Ejecuta npm run db:env para generar .env.local con los valores locales.`,
    );
  }
  return value;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
  if (appEnv !== "local") {
    throw new Error(
      `Seed rechazado: NEXT_PUBLIC_APP_ENV=${appEnv} (solo "local").`,
    );
  }
  assertLocalDatabase(databaseUrl);

  // También rechaza un Supabase que no sea local.
  const authAdmin = readAuthAdminConfig();
  const user = await ensureAuthUser(authAdmin, {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  const { db, close } = createDb(databaseUrl, { max: 1 });

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(merchants)
        .values({
          id: DEMO_MERCHANT_ID,
          name: "Comercio de prueba",
          timezone: "America/Mexico_City",
          // Identificador ficticio: la cuenta Pey real se configura en H5.
          peyBankAccountId: "local-demo-account",
          receivingAccountLabel: "Cuenta de prueba (local)",
        })
        .onConflictDoNothing();

      await tx
        .insert(merchantPreferences)
        .values({ merchantId: DEMO_MERCHANT_ID })
        .onConflictDoNothing();

      await tx
        .insert(merchantUsers)
        .values({ userId: user.id, merchantId: DEMO_MERCHANT_ID })
        .onConflictDoNothing();
    });

    console.log(`✓ Seed local listo. Usuario: ${DEMO_EMAIL}`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
