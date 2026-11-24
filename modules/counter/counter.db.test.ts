import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  charges,
  counterQrs,
  merchants,
  paymentEvents,
  paymentIncidents,
  payments,
} from "@/adapters/db/schema";
import { createTestDb } from "@/adapters/db/testing";
import { createMockPeyAdapter } from "@/adapters/pey/mock";
import type { CreateCounterQrRequest, PeyAdapter } from "@/adapters/pey/types";
import {
  COUNTER_RECENT_LIMIT,
  COUNTER_TEST_PAYMENT_CENTS,
  type CounterPaymentDto,
} from "./types";
import {
  ensureCounterQr,
  listCounterPayments,
  simulateCounterPayment,
} from "./service";

const { db, close } = createTestDb();
const merchantIds: string[] = [];

async function newMerchant() {
  const [merchant] = await db
    .insert(merchants)
    .values({
      name: "Mostrador de prueba",
      peyBankAccountId: `acct-${randomUUID()}`,
    })
    .returning();
  merchantIds.push(merchant.id);
  return merchant;
}

function peyOf(result: "created" | "uncertain") {
  const calls: CreateCounterQrRequest[] = [];
  return {
    calls,
    pey: {
      async createCounterQr(request: CreateCounterQrRequest) {
        calls.push(request);
        if (result === "uncertain") {
          return { status: "uncertain" as const, reason: "timeout" };
        }
        return {
          status: "created" as const,
          peyQrId: `counter-${calls.length}`,
          qrString: `COBRAVOZ-MOCK|counter|${request.merchantId}`,
        };
      },
    },
  };
}

afterEach(async () => {
  if (merchantIds.length === 0) return;
  const chargeRows = await db
    .select({ id: charges.id })
    .from(charges)
    .where(inArray(charges.merchantId, merchantIds));
  const chargeIds = chargeRows.map((row) => row.id);
  if (chargeIds.length > 0) {
    const paymentRows = await db
      .select({ id: payments.id })
      .from(payments)
      .where(inArray(payments.chargeId, chargeIds));
    const paymentIds = paymentRows.map((row) => row.id);
    if (paymentIds.length > 0) {
      const eventRows = await db
        .select({ id: paymentEvents.id })
        .from(paymentEvents)
        .where(inArray(paymentEvents.paymentId, paymentIds));
      const eventIds = eventRows.map((row) => row.id);
      if (eventIds.length > 0) {
        await db
          .delete(paymentIncidents)
          .where(inArray(paymentIncidents.paymentEventId, eventIds));
        await db
          .delete(paymentEvents)
          .where(inArray(paymentEvents.id, eventIds));
      }
    }
    await db
      .update(charges)
      .set({ paidPaymentId: null, status: "created" })
      .where(inArray(charges.id, chargeIds));
    await db.delete(payments).where(inArray(payments.chargeId, chargeIds));
    await db.delete(charges).where(inArray(charges.id, chargeIds));
  }
  await db
    .delete(counterQrs)
    .where(inArray(counterQrs.merchantId, merchantIds));
  await db.delete(merchants).where(inArray(merchants.id, merchantIds));
  merchantIds.length = 0;
});
afterAll(close);

describe("ensureCounterQr", () => {
  it("pide el código una sola vez y lo reutiliza", async () => {
    const merchant = await newMerchant();
    const pey = peyOf("created");

    const first = await ensureCounterQr({ db, pey: pey.pey }, merchant.id);
    const second = await ensureCounterQr({ db, pey: pey.pey }, merchant.id);

    expect(first.status).toBe("ready");
    expect(second).toEqual(first);
    expect(pey.calls).toHaveLength(1);
    expect(pey.calls[0]).toMatchObject({
      merchantId: merchant.id,
      concept: "Transferencia",
      numRef: 0,
      bankAccountId: merchant.peyBankAccountId,
    });
    const [row] = await db
      .select()
      .from(counterQrs)
      .where(eq(counterQrs.merchantId, merchant.id));
    expect(row.status).toBe("ready");
    expect(row.peyQrId).toBe("counter-1");
  });

  it("un fallo no vuelve a llamar a Pey", async () => {
    const merchant = await newMerchant();
    const pey = peyOf("uncertain");

    const first = await ensureCounterQr({ db, pey: pey.pey }, merchant.id);
    const second = await ensureCounterQr({ db, pey: pey.pey }, merchant.id);

    expect(first).toEqual({ status: "uncertain" });
    expect(second).toEqual({ status: "uncertain" });
    expect(pey.calls).toHaveLength(1);
  });
});

describe("simulateCounterPayment", () => {
  it("cada clic abre una venta nueva con el importe de prueba", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const ready = await ensureCounterQr({ db, pey }, merchant.id);
    expect(ready.status).toBe("ready");

    const first = await simulateCounterPayment({ db, pey }, merchant.id);
    const second = await simulateCounterPayment({ db, pey }, merchant.id);

    expect(first.status).toBe("paid");
    expect(second.status).toBe("paid");
    if (first.status !== "paid" || second.status !== "paid") return;
    expect(first.payment.amountCents).toBe(COUNTER_TEST_PAYMENT_CENTS);
    expect(second.payment.id).not.toBe(first.payment.id);
    expect(await listCounterPayments(db, merchant.id)).toEqual([
      second.payment,
      first.payment,
    ]);

    const [stored] = await db
      .select({ evidence: payments.evidenceSource })
      .from(payments)
      .where(eq(payments.chargeId, first.payment.id));
    expect(stored.evidence).toBe("provider_query");
  });

  it("deja en pantalla solo los cinco pagos más recientes", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const ready = await ensureCounterQr({ db, pey }, merchant.id);
    expect(ready.status).toBe("ready");

    const created: CounterPaymentDto[] = [];
    for (let index = 0; index < COUNTER_RECENT_LIMIT + 1; index += 1) {
      const result = await simulateCounterPayment({ db, pey }, merchant.id);
      expect(result.status).toBe("paid");
      if (result.status === "paid") created.push(result.payment);
    }

    const listed = await listCounterPayments(db, merchant.id);

    expect(listed).toHaveLength(COUNTER_RECENT_LIMIT);
    expect(listed[0]?.id).toBe(created.at(-1)?.id);
    expect(listed.map((payment) => payment.id)).not.toContain(created[0]?.id);
  });

  it("no registra nada si el código no es de prueba", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    await ensureCounterQr({ db, pey }, merchant.id);
    await db
      .update(counterQrs)
      .set({ qrPayload: "000201010212" })
      .where(eq(counterQrs.merchantId, merchant.id));

    const result = await simulateCounterPayment({ db, pey }, merchant.id);

    expect(result).toEqual({ status: "unavailable" });
    expect(await listCounterPayments(db, merchant.id)).toEqual([]);
  });

  it("un adaptador real no registra el pago de prueba", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    await ensureCounterQr({ db, pey }, merchant.id);

    const result = await simulateCounterPayment(
      { db, pey: { kind: "real" } as PeyAdapter },
      merchant.id,
    );

    expect(result).toEqual({ status: "unavailable" });
    expect(await listCounterPayments(db, merchant.id)).toEqual([]);
  });
});
