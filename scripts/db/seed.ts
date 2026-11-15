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
import { assertLocalDatabase, isLocalUrl } from "./local-guard";

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
      `Falta ${name}. Copia .env.example a .env.local y completa los valores locales (npm run db:status).`,
    );
  }
  return value;
}

function assertLocalEnvironment(databaseUrl: string, supabaseUrl: string) {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
  if (appEnv !== "local") {
    throw new Error(
      `Seed rechazado: NEXT_PUBLIC_APP_ENV=${appEnv} (solo "local").`,
    );
  }
  assertLocalDatabase(databaseUrl);
  if (!isLocalUrl(supabaseUrl)) {
    throw new Error("Seed rechazado: NEXT_PUBLIC_SUPABASE_URL no es local.");
  }
}

type AuthUser = { id: string; email?: string };

/** Crea el usuario por la API admin de GoTrue, o lo reutiliza si ya existe. */
async function ensureAuthUser(
  supabaseUrl: string,
  secretKey: string,
): Promise<AuthUser> {
  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  const created = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    }),
  });

  if (created.ok) {
    return (await created.json()) as AuthUser;
  }

  const error = (await created.json().catch(() => ({}))) as {
    error_code?: string;
    msg?: string;
  };
  if (error.error_code !== "email_exists") {
    throw new Error(
      `No se pudo crear el usuario demo (${created.status}): ${error.msg ?? "sin detalle"}`,
    );
  }

  const list = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=200`, {
    headers,
  });
  const { users } = (await list.json()) as { users: AuthUser[] };
  const existing = users.find((user) => user.email === DEMO_EMAIL);
  if (!existing) {
    throw new Error("El usuario demo existe pero no se pudo localizar.");
  }
  return existing;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  assertLocalEnvironment(databaseUrl, supabaseUrl);

  const user = await ensureAuthUser(supabaseUrl, secretKey);
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
