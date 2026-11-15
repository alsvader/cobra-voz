import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { assertLocalDatabase } from "../../scripts/db/local-guard";
import { createDb, type Database } from "./create-db";
import { codiQrs, charges, merchants, payments } from "./schema";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const ROLLBACK = Symbol("rollback");

export function createTestDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Levanta Supabase local (npm run db:start), migra (npm run db:migrate) y revisa .env.local.",
    );
  }
  assertLocalDatabase(url);
  return createDb(url, { max: 2 });
}

/**
 * Ejecuta `fn` dentro de una transacción que SIEMPRE se revierte: las pruebas
 * no dejan datos ni dependen del seed.
 */
export async function withRollback(
  db: Database,
  fn: (tx: Tx) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
}

type PgErrorShape = {
  code?: string;
  constraint_name?: string;
  cause?: unknown;
};

/** Drizzle envuelve el error de Postgres en `cause`; se recorre la cadena. */
export function pgErrorOf(error: unknown): PgErrorShape {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as PgErrorShape;
    if (candidate.code) return candidate;
    current = candidate.cause;
  }
  return {};
}

/**
 * Ejecuta `fn` en un savepoint y devuelve el error de Postgres que provocó
 * (la transacción externa sigue utilizable después).
 */
export async function pgErrorFrom(
  tx: Tx,
  fn: (sp: Tx) => Promise<unknown>,
): Promise<PgErrorShape> {
  try {
    await tx.transaction(async (sp) => {
      await fn(sp as Tx);
    });
  } catch (error) {
    return pgErrorOf(error);
  }
  throw new Error(
    "Se esperaba un error de Postgres, pero la operación tuvo éxito.",
  );
}

/**
 * Crea una fila mínima en `auth.users` (solo dentro de la transacción de
 * prueba, que se revierte). Basta para satisfacer la FK de `merchant_users`.
 */
export async function insertAuthUser(tx: Tx): Promise<string> {
  const id = randomUUID();
  await tx.execute(
    sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})`,
  );
  return id;
}

export async function insertMerchant(tx: Tx) {
  const [merchant] = await tx
    .insert(merchants)
    .values({
      name: "Comercio de prueba",
      peyBankAccountId: `acct-${randomUUID()}`,
    })
    .returning();
  return merchant;
}

export async function insertCharge(
  tx: Tx,
  merchantId: string,
  overrides: Partial<typeof charges.$inferInsert> = {},
) {
  const [charge] = await tx
    .insert(charges)
    .values({
      merchantId,
      amountCents: 15000,
      idempotencyKey: randomUUID(),
      ...overrides,
    })
    .returning();
  return charge;
}

export async function insertQr(
  tx: Tx,
  chargeId: string,
  overrides: Partial<typeof codiQrs.$inferInsert> = {},
) {
  const [qr] = await tx
    .insert(codiQrs)
    .values({
      chargeId,
      peyQrId: `qr-${randomUUID()}`,
      numRef: 1234,
      qrPayload: "payload-de-prueba",
      expiresAt: new Date(Date.now() + 600_000),
      ...overrides,
    })
    .returning();
  return qr;
}

export async function insertPayment(
  tx: Tx,
  codiQrId: string,
  overrides: Partial<typeof payments.$inferInsert> = {},
) {
  const [payment] = await tx
    .insert(payments)
    .values({
      codiQrId,
      providerTransactionId: `tx-${randomUUID()}`,
      amountCents: 15000,
      reconciliationStatus: "reconciled",
      evidenceSource: "webhook",
      paidAt: new Date(),
      reconciledAt: new Date(),
      ...overrides,
    })
    .returning();
  return payment;
}
