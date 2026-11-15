/**
 * Tenants de prueba para E2E: usuario real de Supabase Auth (API admin) +
 * comercio + vínculo. Requieren Supabase local (npm run db:start / db:migrate).
 * Cada prueba crea los suyos con datos únicos, así pueden correr en paralelo.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "../../adapters/db/create-db";
import {
  charges,
  codiQrs,
  merchantPreferences,
  merchants,
  merchantUsers,
  paymentIncidents,
  payments,
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
    const rows = await db
      .select({ id: charges.id })
      .from(charges)
      .where(eq(charges.merchantId, tenant.merchantId));
    const chargeIds = rows.map((row) => row.id);
    if (chargeIds.length > 0) {
      await db
        .delete(paymentIncidents)
        .where(inArray(paymentIncidents.chargeId, chargeIds));
      const qrRows = await db
        .select({ id: codiQrs.id })
        .from(codiQrs)
        .where(inArray(codiQrs.chargeId, chargeIds));
      // charges → payments → codi_qrs → charges: se rompe el ciclo primero.
      await db
        .update(charges)
        .set({ status: "created", paidPaymentId: null })
        .where(inArray(charges.id, chargeIds));
      if (qrRows.length > 0) {
        await db.delete(payments).where(
          inArray(
            payments.codiQrId,
            qrRows.map((row) => row.id),
          ),
        );
      }
      await db.delete(codiQrs).where(inArray(codiQrs.chargeId, chargeIds));
      await db.delete(charges).where(inArray(charges.id, chargeIds));
    }
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

/** Cobros del comercio, con su QR y sus incidencias (verificación directa en BD). */
export async function readCharges(merchantId: string) {
  const { db, close } = connect();
  try {
    const rows = await db
      .select()
      .from(charges)
      .where(eq(charges.merchantId, merchantId));
    const ids = rows.map((row) => row.id);
    const qrs = ids.length
      ? await db.select().from(codiQrs).where(inArray(codiQrs.chargeId, ids))
      : [];
    const incidents = ids.length
      ? await db
          .select()
          .from(paymentIncidents)
          .where(inArray(paymentIncidents.chargeId, ids))
      : [];
    return { charges: rows, qrs, incidents };
  } finally {
    await close();
  }
}

/** Cobro sin resolver (`created`), opcionalmente «antiguo», para probar la recuperación. */
export async function insertCreatedCharge(
  merchantId: string,
  options: { createdAt?: Date } = {},
): Promise<string> {
  const { db, close } = connect();
  try {
    const [row] = await db
      .insert(charges)
      .values({
        merchantId,
        amountCents: 9900,
        idempotencyKey: randomUUID(),
        ...(options.createdAt ? { createdAt: options.createdAt } : {}),
      })
      .returning({ id: charges.id });
    return row.id;
  } finally {
    await close();
  }
}

/** Simula el paso del tiempo: vence (o no) el cobro modificando `expires_at`. */
export async function setChargeExpiry(
  chargeId: string,
  expiresAt: Date,
): Promise<void> {
  const { db, close } = connect();
  try {
    await db.update(charges).set({ expiresAt }).where(eq(charges.id, chargeId));
  } finally {
    await close();
  }
}

/**
 * Deja el cobro como `paid` con un pago verificado asociado, tal como lo
 * dejaría el webhook de PR-07. Solo prepara el estado persistido para comprobar
 * que P03 lo refleja; la pantalla nunca lo decide.
 */
export async function markChargePaid(chargeId: string): Promise<void> {
  const { db, close } = connect();
  try {
    const [qr] = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, chargeId));
    const [charge] = await db
      .select({ amountCents: charges.amountCents })
      .from(charges)
      .where(eq(charges.id, chargeId));
    const now = new Date();
    const [payment] = await db
      .insert(payments)
      .values({
        codiQrId: qr.id,
        providerTransactionId: `e2e-tx-${randomUUID()}`,
        amountCents: charge.amountCents,
        reconciliationStatus: "reconciled",
        evidenceSource: "webhook",
        paidAt: now,
        reconciledAt: now,
      })
      .returning({ id: payments.id });
    await db
      .update(charges)
      .set({ status: "paid", paidPaymentId: payment.id })
      .where(eq(charges.id, chargeId));
  } finally {
    await close();
  }
}
