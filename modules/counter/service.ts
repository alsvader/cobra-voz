import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/adapters/db/create-db";
import { charges, counterQrs, merchants, payments } from "@/adapters/db/schema";
import { isSimulatedQr, type MockPeyAdapter } from "@/adapters/pey/mock";
import type { PeyAdapter } from "@/adapters/pey/types";
import { recordPeyPayment } from "@/modules/payments/service";
import { COUNTER_TEST_PAYMENT_CENTS, type CounterPaymentDto } from "./types";

export type { CounterPaymentDto } from "./types";
export { COUNTER_TEST_PAYMENT_CENTS } from "./types";

/** Concepto fijo: el comercio no arma esta venta. */
export const COUNTER_QR_CONCEPT = "Transferencia";
/** Referencia fija del código de mostrador. Cabe en los 7 dígitos de Pey. */
export const COUNTER_QR_NUM_REF = 0;

export type CounterQrView =
  | { status: "ready"; payload: string; simulated: boolean }
  | { status: "pending" }
  | { status: "uncertain" }
  | { status: "missing_account" };

type Deps = { db: Database; pey: Pick<PeyAdapter, "createCounterQr"> };

/**
 * Devuelve el QR de mostrador del comercio. Si no existe, lo pide una vez.
 * Un resultado incierto o una fila a medias no vuelven a llamar a Pey.
 */
export async function ensureCounterQr(
  deps: Deps,
  merchantId: string,
): Promise<CounterQrView> {
  const existing = await readCounterQr(deps.db, merchantId);
  if (existing) return existing;

  const [merchant] = await deps.db
    .select({ bankAccountId: merchants.peyBankAccountId })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);
  if (!merchant?.bankAccountId.trim()) return { status: "missing_account" };

  const [inserted] = await deps.db
    .insert(counterQrs)
    .values({
      merchantId,
      status: "pending",
      numRef: COUNTER_QR_NUM_REF,
      concept: COUNTER_QR_CONCEPT,
    })
    .onConflictDoNothing({ target: counterQrs.merchantId })
    .returning({ id: counterQrs.id });

  if (!inserted) {
    return (await readCounterQr(deps.db, merchantId)) ?? { status: "pending" };
  }

  let outcome;
  try {
    outcome = await deps.pey.createCounterQr({
      merchantId,
      concept: COUNTER_QR_CONCEPT,
      numRef: COUNTER_QR_NUM_REF,
      bankAccountId: merchant.bankAccountId,
    });
  } catch {
    outcome = {
      status: "uncertain" as const,
      reason: "La creación del QR de mostrador falló.",
    };
  }

  if (outcome.status !== "created") {
    await deps.db
      .update(counterQrs)
      .set({ status: "uncertain", updatedAt: new Date() })
      .where(
        and(eq(counterQrs.id, inserted.id), eq(counterQrs.status, "pending")),
      );
    return { status: "uncertain" };
  }

  await deps.db
    .update(counterQrs)
    .set({
      status: "ready",
      peyQrId: outcome.peyQrId,
      qrPayload: outcome.qrString,
      updatedAt: new Date(),
    })
    .where(
      and(eq(counterQrs.id, inserted.id), eq(counterQrs.status, "pending")),
    );

  return {
    status: "ready",
    payload: outcome.qrString,
    simulated: isSimulatedQr(outcome.qrString),
  };
}

export type SimulatedCounterPayment =
  { status: "paid"; payment: CounterPaymentDto } | { status: "unavailable" };

/**
 * Registra una transferencia de prueba contra el QR de mostrador.
 * El simulador es quien reporta el pago; esta función no marca nada pagado
 * si esa consulta no devuelve la transferencia. Solo sirve con un QR de
 * prueba: un código real no se toca.
 */
export async function simulateCounterPayment(
  deps: { db: Database; pey: PeyAdapter },
  merchantId: string,
): Promise<SimulatedCounterPayment> {
  if (deps.pey.kind !== "mock") return { status: "unavailable" };
  const mock = deps.pey as MockPeyAdapter;

  const [row] = await deps.db
    .select({
      peyQrId: counterQrs.peyQrId,
      qrPayload: counterQrs.qrPayload,
      numRef: counterQrs.numRef,
      bankAccountId: merchants.peyBankAccountId,
    })
    .from(counterQrs)
    .innerJoin(merchants, eq(merchants.id, counterQrs.merchantId))
    .where(
      and(
        eq(counterQrs.merchantId, merchantId),
        eq(counterQrs.status, "ready"),
      ),
    )
    .limit(1);
  if (!row?.peyQrId || !row.qrPayload || !isSimulatedQr(row.qrPayload)) {
    return { status: "unavailable" };
  }

  const transactionId = `mock-counter-tx-${randomUUID()}`;
  const paidAt = new Date();
  let queried;
  try {
    mock.seedPayment(row.peyQrId, {
      transactionId,
      amountCents: COUNTER_TEST_PAYMENT_CENTS,
      numRef: row.numRef,
      bankAccountId: row.bankAccountId,
      paidAt,
    });
    queried = await mock.queryCodiQrPayments(row.peyQrId);
  } catch {
    return { status: "unavailable" };
  }
  if (queried.status !== "ok") return { status: "unavailable" };
  const reported = queried.payments.find(
    (payment) => payment.transactionId === transactionId,
  );
  if (!reported) return { status: "unavailable" };

  const recorded = await recordPeyPayment(
    deps,
    `query:${transactionId}`,
    {
      kind: "qr",
      codiQrId: row.peyQrId,
      transactionId,
      amountCents: reported.amountCents,
      numRef: reported.numRef ?? row.numRef,
      bankAccountId: reported.bankAccountId?.trim() || row.bankAccountId,
      paidAt: reported.paidAt,
      chargeId: null,
    },
    { evidenceSource: "provider_query" },
  );
  if (recorded.outcome !== "paid" || recorded.duplicate) {
    return { status: "unavailable" };
  }

  const [created] = await deps.db
    .select({ id: charges.id, amountCents: payments.amountCents })
    .from(payments)
    .innerJoin(charges, eq(charges.paidPaymentId, payments.id))
    .where(eq(payments.providerTransactionId, transactionId))
    .limit(1);
  if (!created) return { status: "unavailable" };
  return { status: "paid", payment: created };
}

/** Pagos conciliados de este código, del más reciente al más antiguo. */
export async function listCounterPayments(
  db: Database,
  merchantId: string,
  limit = 8,
): Promise<CounterPaymentDto[]> {
  return db
    .select({
      id: charges.id,
      amountCents: payments.amountCents,
    })
    .from(charges)
    .innerJoin(payments, eq(payments.id, charges.paidPaymentId))
    .where(
      and(
        eq(charges.merchantId, merchantId),
        eq(charges.collectionMethod, "counter"),
        eq(charges.status, "paid"),
        eq(payments.reconciliationStatus, "reconciled"),
      ),
    )
    .orderBy(desc(payments.paidAt), desc(charges.id))
    .limit(limit);
}

async function readCounterQr(
  db: Database,
  merchantId: string,
): Promise<CounterQrView | null> {
  const [row] = await db
    .select({
      status: counterQrs.status,
      qrPayload: counterQrs.qrPayload,
    })
    .from(counterQrs)
    .where(eq(counterQrs.merchantId, merchantId))
    .limit(1);
  if (!row) return null;
  if (row.status === "ready" && row.qrPayload) {
    return {
      status: "ready",
      payload: row.qrPayload,
      simulated: isSimulatedQr(row.qrPayload),
    };
  }
  if (row.status === "uncertain") return { status: "uncertain" };
  return { status: "pending" };
}
