import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  charges,
  codiQrs,
  merchants,
  paymentEvents,
  paymentIncidents,
  payments,
} from "@/adapters/db/schema";
import { createTestDb } from "@/adapters/db/testing";
import {
  MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS,
  createMockPeyAdapter,
  type MockPeyAdapter,
} from "@/adapters/pey/mock";
import type { QueriedPayment } from "@/adapters/pey/types";
import { closeCharge, createCharge } from "@/modules/charges/service";
import { recordPeyPayment } from "./service";
import { reconcileCharge, reconcilePending } from "./reconcile";

const { db, close } = createTestDb();
const merchantIds: string[] = [];

async function newMerchant() {
  const [merchant] = await db
    .insert(merchants)
    .values({
      name: "Comercio de conciliación",
      peyBankAccountId: `acct-${randomUUID()}`,
    })
    .returning();
  merchantIds.push(merchant.id);
  return merchant;
}

async function openCharge(
  pey: MockPeyAdapter,
  merchantId: string,
  amountCents = 15050,
) {
  const created = await createCharge({ db, pey }, merchantId, {
    amountCents,
    idempotencyKey: randomUUID(),
  });
  if (!created.ok || created.charge.status !== "waiting_payment") {
    throw new Error("setup");
  }
  const [qr] = await db
    .select()
    .from(codiQrs)
    .where(eq(codiQrs.chargeId, created.charge.id));
  return { charge: created.charge, qr };
}

function matchingPayment(
  qr: { peyQrId: string; numRef: number },
  account: string,
  overrides: Partial<QueriedPayment> = {},
): QueriedPayment {
  return {
    transactionId: `tx-${randomUUID()}`,
    amountCents: 15050,
    numRef: qr.numRef,
    bankAccountId: account,
    paidAt: new Date("2026-11-15T18:00:00.000Z"),
    ...overrides,
  };
}

afterEach(async () => {
  if (merchantIds.length === 0) return;
  const rows = await db
    .select({ id: charges.id })
    .from(charges)
    .where(inArray(charges.merchantId, merchantIds));
  const chargeIds = rows.map((row) => row.id);
  if (chargeIds.length > 0) {
    await db
      .delete(paymentIncidents)
      .where(inArray(paymentIncidents.chargeId, chargeIds));
    const qrRows = await db
      .select({ id: codiQrs.id })
      .from(codiQrs)
      .where(inArray(codiQrs.chargeId, chargeIds));
    const qrIds = qrRows.map((row) => row.id);
    await db
      .update(charges)
      .set({ status: "created", paidPaymentId: null })
      .where(inArray(charges.id, chargeIds));
    if (qrIds.length > 0) {
      await db
        .delete(paymentEvents)
        .where(inArray(paymentEvents.codiQrId, qrIds));
      await db.delete(payments).where(inArray(payments.codiQrId, qrIds));
      await db.delete(codiQrs).where(inArray(codiQrs.id, qrIds));
    }
    await db.delete(charges).where(inArray(charges.id, chargeIds));
  }
  await db.delete(merchants).where(inArray(merchants.id, merchantIds));
  merchantIds.length = 0;
});
afterAll(close);

describe("reconcileCharge", () => {
  it("un pago consultado que coincide deja el cobro pagado una sola vez", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const { charge, qr } = await openCharge(pey, merchant.id);
    const payment = matchingPayment(qr, merchant.peyBankAccountId);
    pey.seedPayment(qr.peyQrId, payment);

    const first = await reconcileCharge({ db, pey }, merchant.id, charge.id);
    const second = await reconcileCharge({ db, pey }, merchant.id, charge.id);

    expect(first).toMatchObject({ ok: true, outcome: "paid", queried: true });
    expect(second).toMatchObject({ ok: true, outcome: "paid", queried: false });
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      providerTransactionId: payment.transactionId,
      reconciliationStatus: "reconciled",
      evidenceSource: "provider_query",
    });
    expect(pey.queryCalls).toEqual([qr.peyQrId]);
  });

  it("si el webhook ya registró la transacción, la consulta no crea otro pago", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const { charge, qr } = await openCharge(pey, merchant.id);
    const payment = matchingPayment(qr, merchant.peyBankAccountId);
    await recordPeyPayment({ db }, `msg_${randomUUID()}`, {
      ...payment,
      codiQrId: qr.peyQrId,
    });

    const result = await reconcileCharge({ db, pey }, merchant.id, charge.id);

    expect(result).toMatchObject({ ok: true, outcome: "paid", queried: false });
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].evidenceSource).toBe("webhook");
    expect(pey.queryCalls).toHaveLength(0);
  });

  it("la consulta y un webhook posterior de la misma transacción quedan en un pago", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const { charge, qr } = await openCharge(pey, merchant.id);
    const payment = matchingPayment(qr, merchant.peyBankAccountId);
    pey.seedPayment(qr.peyQrId, payment);

    await reconcileCharge({ db, pey }, merchant.id, charge.id);
    await recordPeyPayment({ db }, `msg_${randomUUID()}`, {
      ...payment,
      codiQrId: qr.peyQrId,
    });

    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].evidenceSource).toBe("provider_query");
  });

  it("un importe distinto queda en incidencia y no cuenta como pagado", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const { charge, qr } = await openCharge(pey, merchant.id);
    pey.seedPayment(
      qr.peyQrId,
      matchingPayment(qr, merchant.peyBankAccountId, { amountCents: 100 }),
    );

    const result = await reconcileCharge({ db, pey }, merchant.id, charge.id);

    expect(result).toMatchObject({
      ok: true,
      outcome: "incident",
      queried: true,
    });
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, charge.id));
    expect(row.status).toBe("incident");
    expect(row.paidPaymentId).toBeNull();
  });

  it("si Pey no responde, el cobro sigue esperando y se anota el intento", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const { charge } = await openCharge(
      pey,
      merchant.id,
      MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS,
    );

    const result = await reconcileCharge({ db, pey }, merchant.id, charge.id);

    expect(result).toMatchObject({ ok: false, error: "unavailable" });
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, charge.id));
    expect(row.status).toBe("waiting_payment");
    expect(row.paidPaymentId).toBeNull();
    expect(row.lastReconciliationAt).toBeInstanceOf(Date);
  });

  it("sin QR confirmado no llama a Pey", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const [charge] = await db
      .insert(charges)
      .values({
        merchantId: merchant.id,
        amountCents: 1000,
        idempotencyKey: randomUUID(),
        status: "waiting_payment",
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();

    const result = await reconcileCharge({ db, pey }, merchant.id, charge.id);

    expect(result).toMatchObject({ ok: false, error: "not_reconcilable" });
    expect(pey.queryCalls).toHaveLength(0);
  });

  it("un cobro de otro comercio no se consulta", async () => {
    const owner = await newMerchant();
    const intruder = await newMerchant();
    const pey = createMockPeyAdapter();
    const { charge, qr } = await openCharge(pey, owner.id);
    pey.seedPayment(qr.peyQrId, matchingPayment(qr, owner.peyBankAccountId));

    const result = await reconcileCharge({ db, pey }, intruder.id, charge.id);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(pey.queryCalls).toHaveLength(0);
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, charge.id));
    expect(row.status).toBe("waiting_payment");
  });

  it("un cobro cerrado en local se paga si la consulta trae el pago", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const { charge, qr } = await openCharge(pey, merchant.id);
    const closed = await closeCharge({ db }, merchant.id, charge.id);
    if (!closed.ok) throw new Error("setup");
    pey.seedPayment(qr.peyQrId, matchingPayment(qr, merchant.peyBankAccountId));

    const result = await reconcileCharge({ db, pey }, merchant.id, charge.id);

    expect(result).toMatchObject({ ok: true, outcome: "paid" });
  });
});

describe("reconcilePending", () => {
  it("recupera un vencido reciente y no pregunta por uno vencido hace días", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const recent = await openCharge(pey, merchant.id);
    const stale = await openCharge(pey, merchant.id, 2000);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const daysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await db
      .update(charges)
      .set({ status: "expired", expiresAt: hourAgo })
      .where(eq(charges.id, recent.charge.id));
    await db
      .update(charges)
      .set({ status: "expired", expiresAt: daysAgo })
      .where(eq(charges.id, stale.charge.id));
    pey.seedPayment(
      recent.qr.peyQrId,
      matchingPayment(recent.qr, merchant.peyBankAccountId),
    );
    pey.seedPayment(
      stale.qr.peyQrId,
      matchingPayment(stale.qr, merchant.peyBankAccountId, {
        amountCents: 2000,
      }),
    );

    const run = await reconcilePending({ db, pey }, { merchantId: merchant.id });

    expect(run.paid).toBe(1);
    expect(pey.queryCalls).toEqual([recent.qr.peyQrId]);
    const [recentRow] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, recent.charge.id));
    const [staleRow] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, stale.charge.id));
    expect(recentRow.status).toBe("paid");
    expect(staleRow.status).toBe("expired");
    expect(staleRow.paidPaymentId).toBeNull();
  });

  it("no vuelve a preguntar por el mismo cobro dentro del intervalo", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    await openCharge(pey, merchant.id);

    const first = await reconcilePending({ db, pey }, { merchantId: merchant.id });
    const second = await reconcilePending(
      { db, pey },
      { merchantId: merchant.id },
    );

    expect(first).toMatchObject({ examined: 1, unchanged: 1 });
    expect(second).toMatchObject({ examined: 0, paid: 0 });
    expect(pey.queryCalls).toHaveLength(1);
  });

  it("un QR que nunca se confirmó no entra en la pasada", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    await createCharge({ db, pey }, merchant.id, {
      amountCents: 1301,
      idempotencyKey: randomUUID(),
    });

    const run = await reconcilePending({ db, pey }, { merchantId: merchant.id });

    expect(run.examined).toBe(0);
    expect(pey.queryCalls).toHaveLength(0);
  });
});
