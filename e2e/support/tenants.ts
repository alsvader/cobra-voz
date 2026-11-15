/**
 * Tenants de prueba para E2E: usuario real de Supabase Auth (API admin) +
 * comercio + vínculo. Requieren Supabase local (npm run db:start / db:migrate).
 * Cada prueba crea los suyos con datos únicos, así pueden correr en paralelo.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb } from "../../adapters/db/create-db";
import {
  merchantPreferences,
  merchants,
  merchantUsers,
} from "../../adapters/db/schema";
import { assertLocalDatabase } from "../../scripts/db/local-guard";
import {
  createAuthUser,
  deleteAuthUser,
  readAuthAdminConfig,
} from "../../scripts/db/auth-admin";

export type Tenant = {
  email: string;
  password: string;
  userId: string;
  /** Vacío si el usuario se creó sin comercio. */
  merchantId: string | null;
  merchantName: string | null;
};

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL: ejecuta npm run db:env.");
  }
  assertLocalDatabase(url);
  return createDb(url, { max: 1 });
}

export async function createTenant(
  options: { withMerchant?: boolean; label?: string } = {},
): Promise<Tenant> {
  const { withMerchant = true, label = "Negocio" } = options;
  const suffix = randomUUID().slice(0, 8);
  const email = `e2e-${suffix}@cobravoz.local`;
  const password = `pw-${randomUUID()}`;

  const user = await createAuthUser(readAuthAdminConfig(), { email, password });
  if (!withMerchant) {
    return {
      email,
      password,
      userId: user.id,
      merchantId: null,
      merchantName: null,
    };
  }

  const merchantName = `${label} ${suffix}`;
  const { db, close } = connect();
  try {
    const [merchant] = await db
      .insert(merchants)
      .values({
        name: merchantName,
        peyBankAccountId: `e2e-acct-${suffix}`,
        receivingAccountLabel: `Cuenta ${suffix}`,
      })
      .returning({ id: merchants.id });
    await db
      .insert(merchantUsers)
      .values({ userId: user.id, merchantId: merchant.id });
    await db.insert(merchantPreferences).values({ merchantId: merchant.id });

    return {
      email,
      password,
      userId: user.id,
      merchantId: merchant.id,
      merchantName,
    };
  } finally {
    await close();
  }
}

export async function deleteTenant(tenant: Tenant): Promise<void> {
  // Borrar el usuario elimina su vínculo (ON DELETE CASCADE).
  await deleteAuthUser(readAuthAdminConfig(), tenant.userId);
  if (!tenant.merchantId) return;

  const { db, close } = connect();
  try {
    await db
      .delete(merchantPreferences)
      .where(eq(merchantPreferences.merchantId, tenant.merchantId));
    await db.delete(merchants).where(eq(merchants.id, tenant.merchantId));
  } finally {
    await close();
  }
}

export async function readVoiceAnnouncements(
  merchantId: string,
): Promise<boolean | undefined> {
  const { db, close } = connect();
  try {
    const [row] = await db
      .select({ value: merchantPreferences.voiceAnnouncementsEnabled })
      .from(merchantPreferences)
      .where(eq(merchantPreferences.merchantId, merchantId));
    return row?.value;
  } finally {
    await close();
  }
}
