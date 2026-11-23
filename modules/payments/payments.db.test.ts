import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  charges,
  codiNotifications,
  codiQrs,
  counterQrs,
  merchants,
  paymentEvents,
  paymentIncidents,
  paymentLinks,
  payments,
} from "@/adapters/db/schema";
import { createTestDb } from "@/adapters/db/testing";
import { createMockPeyAdapter } from "@/adapters/pey/mock";
import { closeCharge, createCharge } from "@/modules/charges/service";
import { recordPeyPayment } from "./service";
import type { PeyPaymentNotice } from "./schema";

const { db, close } = createTestDb();
const merchantIds: string[] = [];
const webhookIds: string[] = [];

async function newMerchant(account = `acct-${randomUUID()}`) {
  const [merchant] = await db
    .insert(merchants)
    .values({
      name: "Comercio de pruebas de pagos",
      peyBankAccountId: account,
    })
    .returning();
  merchantIds.push(merchant.id);
  return merchant;
}

async function waitingCharge(merchantId: string, account: string) {
  const created = await createCharge(
    { db, pey: createMockPeyAdapter() },
    merchantId,
    { amountCents: 15050, idempotencyKey: randomUUID() },
  );
  if (!created.ok || created.charge.status !== "waiting_payment") {
    throw new Error("setup");
  }
  const [qr] = await db
    .select()
    .from(codiQrs)
    .where(eq(codiQrs.chargeId, created.charge.id));
  return { charge: created.charge, qr, account };
}

function notice(
  qr: { peyQrId: string; numRef: number },
  account: string,
  overrides: Partial<Extract<PeyPaymentNotice, { kind: "qr" }>> = {},
): Extract<PeyPaymentNotice, { kind: "qr" }> {
  return {
    kind: "qr",
    transactionId: `tx-${randomUUID()}`,
    codiQrId: qr.peyQrId,
    chargeId: null,
    amountCents: 15050,
    numRef: qr.numRef,
    bankAccountId: account,
    paidAt: new Date("2026-11-15T18:00:00.000Z"),
    ...overrides,
  };
}

const webhook = () => {
  const id = `msg_${randomUUID()}`;
  webhookIds.push(id);
  return id;
};

afterEach(async () => {
  if (webhookIds.length > 0) {
    const events = await db
      .select({ id: paymentEvents.id })
      .from(paymentEvents)
      .where(inArray(paymentEvents.webhookId, webhookIds));
    const eventIds = events.map((row) => row.id);
    if (eventIds.length > 0) {
      await db
        .delete(paymentIncidents)
        .where(inArray(paymentIncidents.paymentEventId, eventIds));
      await db.delete(paymentEvents).where(inArray(paymentEvents.id, eventIds));
    }
    webhookIds.length = 0;
  }
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
      await db.delete(payments).where(inArray(payments.codiQrId, qrIds));
      await db.delete(codiQrs).where(inArray(codiQrs.id, qrIds));
    }
    const noteRows = await db
      .select({ id: codiNotifications.id })
      .from(codiNotifications)
      .where(inArray(codiNotifications.chargeId, chargeIds));
    if (noteRows.length > 0) {
      await db.delete(payments).where(
        inArray(
          payments.codiNotificationId,
          noteRows.map((row) => row.id),
        ),
      );
      await db
        .delete(codiNotifications)
        .where(inArray(codiNotifications.chargeId, chargeIds));
    }
    const linkRows = await db
      .select({ id: paymentLinks.id })
      .from(paymentLinks)
      .where(inArray(paymentLinks.chargeId, chargeIds));
    const linkIds = linkRows.map((row) => row.id);
    if (linkIds.length > 0) {
      await db
        .delete(paymentEvents)
        .where(inArray(paymentEvents.paymentLinkId, linkIds));
      await db.delete(payments).where(inArray(payments.paymentLinkId, linkIds));
      await db.delete(paymentLinks).where(inArray(paymentLinks.id, linkIds));
    }
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

describe("recordPeyPayment", () => {
  it("un aviso que coincide deja el cobro pagado y el pago conciliado", async () => {
    const merchant = await newMerchant();
    const { charge, qr, account } = await waitingCharge(
      merchant.id,
      merchant.peyBankAccountId,
    );

    const result = await recordPeyPayment(
      { db },
      webhook(),
      notice(qr, account),
    );

    expect(result).toEqual({ outcome: "paid", duplicate: false });
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, charge.id));
    expect(row.status).toBe("paid");
    expect(row.paidPaymentId).not.toBeNull();
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(payment).toMatchObject({
      amountCents: 15050,
      reconciliationStatus: "reconciled",
      evidenceSource: "webhook",
    });
  });

  it("repetir el mismo webhook-id no crea otro pago", async () => {
    const merchant = await newMerchant();
    const { qr, account } = await waitingCharge(
      merchant.id,
      merchant.peyBankAccountId,
    );
    const id = webhook();
    const payload = notice(qr, account);

    await recordPeyPayment({ db }, id, payload);
    const again = await recordPeyPayment({ db }, id, payload);

    expect(again.duplicate).toBe(true);
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(rows).toHaveLength(1);
  });

  it("otra entrega de la misma transacción tampoco duplica el pago", async () => {
    const merchant = await newMerchant();
    const { qr, account } = await waitingCharge(
      merchant.id,
      merchant.peyBankAccountId,
    );
    const payload = notice(qr, account);

    await recordPeyPayment({ db }, webhook(), payload);
    const again = await recordPeyPayment({ db }, webhook(), payload);

    expect(again).toEqual({ outcome: "paid", duplicate: true });
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(rows).toHaveLength(1);
  });

  it("entregas simultáneas del mismo webhook crean un solo pago", async () => {
    const merchant = await newMerchant();
    const { qr, account } = await waitingCharge(
      merchant.id,
      merchant.peyBankAccountId,
    );
    const id = webhook();
    const payload = notice(qr, account);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => recordPeyPayment({ db }, id, payload)),
    );

    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(rows).toHaveLength(1);
  });

  it("un importe distinto no marca pagado: guarda incidencia y el pago no concilia", async () => {
    const merchant = await newMerchant();
    const { charge, qr, account } = await waitingCharge(
      merchant.id,
      merchant.peyBankAccountId,
    );

    const result = await recordPeyPayment(
      { db },
      webhook(),
      notice(qr, account, { amountCents: 100 }),
    );

    expect(result).toEqual({ outcome: "incident", duplicate: false });
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, charge.id));
    expect(row.status).toBe("incident");
    expect(row.paidPaymentId).toBeNull();
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(payment.reconciliationStatus).toBe("incident");
    const incidents = await db
      .select()
      .from(paymentIncidents)
      .where(eq(paymentIncidents.chargeId, charge.id));
    expect(incidents.map((item) => item.type)).toEqual(["amount_mismatch"]);
  });

  it("un aviso de un centavo cierra el cobro y conserva el importe capturado", async () => {
    const merchant = await newMerchant();
    const { charge, qr, account } = await waitingCharge(
      merchant.id,
      merchant.peyBankAccountId,
    );

    const result = await recordPeyPayment(
      { db },
      webhook(),
      notice(qr, account, { amountCents: 1 }),
    );

    expect(result).toEqual({ outcome: "paid", duplicate: false });
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, charge.id));
    expect(row.status).toBe("paid");
    expect(row.amountCents).toBe(15050);
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.codiQrId, qr.id));
    expect(payment.amountCents).toBe(1);
    expect(payment.reconciliationStatus).toBe("reconciled");
  });

  it("una cuenta o referencia distinta tampoco acredita el cobro", async () => {
    const merchant = await newMerchant();
    const { charge, qr, account } = await waitingCharge(
      merchant.id,
      merchant.peyBankAccountId,
    );

    await recordPeyPayment(
      { db },
      webhook(),
      notice(qr, account, { bankAccountId: "otra-cuenta" }),
    );

    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, charge.id));
    expect(row.status).toBe("incident");
    const incidents = await db
      .select()
      .from(paymentIncidents)
      .where(eq(paymentIncidents.chargeId, charge.id));
    expect(incidents[0].type).toBe("account_mismatch");
  });

  it("dos pagos del QR de mostrador crean dos ventas por el importe escrito", async () => {
    const merchant = await newMerchant();
    const [counter] = await db
      .insert(counterQrs)
      .values({
        merchantId: merchant.id,
        status: "ready",
        peyQrId: `counter-${randomUUID()}`,
        numRef: 0,
        qrPayload: `COBRAVOZ-MOCK|counter|${merchant.id}`,
        concept: "Transferencia",
      })
      .returning();

    const first = await recordPeyPayment({ db }, webhook(), {
      kind: "qr",
      chargeId: null,
      transactionId: `tx-${randomUUID()}`,
      codiQrId: counter.peyQrId!,
      amountCents: 15000,
      numRef: 0,
      bankAccountId: merchant.peyBankAccountId,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });
    const second = await recordPeyPayment({ db }, webhook(), {
      kind: "qr",
      chargeId: null,
      transactionId: `tx-${randomUUID()}`,
      codiQrId: counter.peyQrId!,
      amountCents: 8050,
      numRef: 0,
      bankAccountId: merchant.peyBankAccountId,
      paidAt: new Date("2026-11-15T18:05:00.000Z"),
    });

    expect(first).toEqual({ outcome: "paid", duplicate: false });
    expect(second).toEqual({ outcome: "paid", duplicate: false });
    const rows = await db
      .select({
        amountCents: charges.amountCents,
        method: charges.collectionMethod,
      })
      .from(charges)
      .where(eq(charges.merchantId, merchant.id));
    expect(rows).toEqual(
      expect.arrayContaining([
        { amountCents: 15000, method: "counter" },
        { amountCents: 8050, method: "counter" },
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it("un aviso del mostrador con otra cuenta no crea una venta", async () => {
    const merchant = await newMerchant();
    const [counter] = await db
      .insert(counterQrs)
      .values({
        merchantId: merchant.id,
        status: "ready",
        peyQrId: `counter-${randomUUID()}`,
        numRef: 0,
        qrPayload: `COBRAVOZ-MOCK|counter|${merchant.id}`,
        concept: "Transferencia",
      })
      .returning();

    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "qr",
      chargeId: null,
      transactionId: `tx-${randomUUID()}`,
      codiQrId: counter.peyQrId!,
      amountCents: 15000,
      numRef: 0,
      bankAccountId: "otra-cuenta",
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });

    expect(result).toEqual({ outcome: "incident", duplicate: false });
    const rows = await db
      .select({ id: charges.id })
      .from(charges)
      .where(eq(charges.merchantId, merchant.id));
    expect(rows).toHaveLength(0);
  });

  it("un QR desconocido no crea cobro ni pago", async () => {
    const transactionId = `tx-${randomUUID()}`;
    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "qr",
      chargeId: null,
      transactionId,
      codiQrId: `qr-desconocido-${randomUUID()}`,
      amountCents: 15050,
      numRef: 1,
      bankAccountId: "acct",
      paidAt: new Date(),
    });

    expect(result.outcome).toBe("incident");
    const paymentRows = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.providerTransactionId, transactionId));
    expect(paymentRows).toHaveLength(0);
  });

  it("un cobro vencido o cerrado en local sí queda pagado si el aviso coincide", async () => {
    const merchant = await newMerchant();
    const expired = await waitingCharge(merchant.id, merchant.peyBankAccountId);
    await db
      .update(charges)
      .set({ status: "expired" })
      .where(eq(charges.id, expired.charge.id));
    const closed = await waitingCharge(merchant.id, merchant.peyBankAccountId);
    await closeCharge({ db }, merchant.id, closed.charge.id);

    await recordPeyPayment(
      { db },
      webhook(),
      notice(expired.qr, expired.account),
    );
    await recordPeyPayment(
      { db },
      webhook(),
      notice(closed.qr, closed.account),
    );

    const rows = await db
      .select({ id: charges.id, status: charges.status })
      .from(charges)
      .where(inArray(charges.id, [expired.charge.id, closed.charge.id]));
    expect(rows.every((row) => row.status === "paid")).toBe(true);
  });

  it("un aviso de notificación que coincide deja el cobro pagado", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      {
        amountCents: 15050,
        idempotencyKey: randomUUID(),
        method: "pn",
        phoneNumber: "5512345678",
      },
    );
    if (!created.ok) throw new Error("setup");
    const [note] = await db
      .select()
      .from(codiNotifications)
      .where(eq(codiNotifications.chargeId, created.charge.id));

    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "pn",
      transactionId: note.peyTransactionId,
      amountCents: 1,
      numRef: note.numRef,
      bankAccountId: merchant.peyBankAccountId,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
      chargeId: created.charge.id,
    });

    expect(result).toEqual({ outcome: "paid", duplicate: false });
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, created.charge.id));
    expect(row.status).toBe("paid");
  });

  it("un transactionId de notificación desconocido no crea un cobro", async () => {
    const transactionId = `tx-${randomUUID()}`;
    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "pn",
      transactionId,
      amountCents: 1,
      numRef: 1,
      bankAccountId: "acct",
      paidAt: new Date(),
      chargeId: null,
    });

    expect(result.outcome).toBe("incident");
    const paymentRows = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.providerTransactionId, transactionId));
    expect(paymentRows).toHaveLength(0);
  });

  it("un chargeId distinto en la notificación queda como incidencia", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      {
        amountCents: 15050,
        idempotencyKey: randomUUID(),
        method: "pn",
        phoneNumber: "5512345678",
      },
    );
    if (!created.ok) throw new Error("setup");
    const [note] = await db
      .select()
      .from(codiNotifications)
      .where(eq(codiNotifications.chargeId, created.charge.id));

    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "pn",
      transactionId: note.peyTransactionId,
      amountCents: 1,
      numRef: note.numRef,
      bankAccountId: merchant.peyBankAccountId,
      paidAt: new Date(),
      chargeId: "00000000-0000-4000-8000-000000000099",
    });

    expect(result.outcome).toBe("incident");
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, created.charge.id));
    expect(row.status).toBe("incident");
  });

  it("un enlace pagado guarda el dinero liquidado si la base coincide", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 10000, idempotencyKey: randomUUID(), method: "link" },
    );
    if (!created.ok) throw new Error("setup");
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.chargeId, created.charge.id));

    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "link",
      paymentLinkId: link.peyPaymentLinkId,
      settles: true,
      transactionId: `tx-${randomUUID()}`,
      amountCents: 11850,
      baseCents: 10000,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
      chargeId: created.charge.id,
    });

    expect(result).toEqual({ outcome: "paid", duplicate: false });
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentLinkId, link.id));
    expect(payment.amountCents).toBe(11850);
    expect(payment.codiQrId).toBeNull();
    expect(payment.codiNotificationId).toBeNull();
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, created.charge.id));
    expect(row.status).toBe("paid");
    expect(row.amountCents).toBe(10000);
  });

  it("un enlace de un centavo cierra el cobro y conserva el importe capturado", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 15050, idempotencyKey: randomUUID(), method: "link" },
    );
    if (!created.ok) throw new Error("setup");
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.chargeId, created.charge.id));

    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "link",
      paymentLinkId: link.peyPaymentLinkId,
      settles: true,
      transactionId: `tx-${randomUUID()}`,
      amountCents: 1,
      baseCents: 1,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
      chargeId: created.charge.id,
    });

    expect(result).toEqual({ outcome: "paid", duplicate: false });
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentLinkId, link.id));
    expect(payment.amountCents).toBe(1);
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, created.charge.id));
    expect(row.status).toBe("paid");
    expect(row.amountCents).toBe(15050);
  });

  it("un enlace pendiente no cierra el cobro", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 10000, idempotencyKey: randomUUID(), method: "link" },
    );
    if (!created.ok) throw new Error("setup");
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.chargeId, created.charge.id));

    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "link",
      paymentLinkId: link.peyPaymentLinkId,
      settles: false,
      transactionId: null,
      amountCents: 0,
      baseCents: 0,
      paidAt: new Date(0),
      chargeId: null,
    });

    expect(result).toEqual({ outcome: "ignored", duplicate: false });
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, created.charge.id));
    expect(row.status).toBe("waiting_payment");
  });

  it("un enlace desconocido no crea un cobro", async () => {
    const paymentLinkId = `link-${randomUUID()}`;
    const transactionId = `tx-${randomUUID()}`;
    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "link",
      paymentLinkId,
      settles: true,
      transactionId,
      amountCents: 10000,
      baseCents: 10000,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
      chargeId: null,
    });

    expect(result.outcome).toBe("incident");
    const links = await db
      .select({ id: paymentLinks.id })
      .from(paymentLinks)
      .where(eq(paymentLinks.peyPaymentLinkId, paymentLinkId));
    const paymentRows = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.providerTransactionId, transactionId));
    expect(links).toHaveLength(0);
    expect(paymentRows).toHaveLength(0);
  });

  it("una referencia distinta en el enlace queda como incidencia", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 10000, idempotencyKey: randomUUID(), method: "link" },
    );
    if (!created.ok) throw new Error("setup");
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.chargeId, created.charge.id));

    const result = await recordPeyPayment({ db }, webhook(), {
      kind: "link",
      paymentLinkId: link.peyPaymentLinkId,
      settles: true,
      transactionId: `tx-${randomUUID()}`,
      amountCents: 10000,
      baseCents: 10000,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
      chargeId: "00000000-0000-4000-8000-000000000099",
    });

    expect(result.outcome).toBe("incident");
    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, created.charge.id));
    expect(row.status).toBe("incident");
  });
});
