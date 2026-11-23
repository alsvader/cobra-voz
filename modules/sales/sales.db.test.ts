import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  charges,
  codiNotifications,
  codiQrs,
  counterQrs,
  merchants,
  paymentLinks,
  payments,
} from "@/adapters/db/schema";
import { createTestDb } from "@/adapters/db/testing";
import { getDailySummary, getMovementDetail, listMovements } from "./service";

const { db, close } = createTestDb();
const merchantIds: string[] = [];
const NOON = new Date("2026-11-15T18:00:00.000Z");

async function newMerchant(timezone = "America/Mexico_City") {
  const [merchant] = await db
    .insert(merchants)
    .values({
      name: "Comercio de ventas",
      timezone,
      peyBankAccountId: `acct-${randomUUID()}`,
    })
    .returning();
  merchantIds.push(merchant.id);
  return merchant;
}

async function addCharge(
  merchantId: string,
  options: {
    amountCents?: number;
    status?: "waiting_payment" | "paid" | "incident" | "expired";
    createdAt?: Date;
    expiresAt?: Date | null;
    paidAt?: Date | null;
    reconciliationStatus?: "reconciled" | "incident";
    /** Importe del pago. Si no viene, es el mismo que el cobro. */
    receivedCents?: number;
    /** `pn` guarda el pago en la notificación. `link`, en el enlace. `counter`, en el QR fijo. */
    method?: "qr" | "pn" | "link" | "counter";
  } = {},
) {
  const amountCents = options.amountCents ?? 15050;
  const createdAt = options.createdAt ?? NOON;
  const method = options.method ?? "qr";
  const [charge] = await db
    .insert(charges)
    .values({
      merchantId,
      amountCents,
      idempotencyKey: randomUUID(),
      status: "waiting_payment",
      collectionMethod: method,
      phoneHash:
        method === "pn"
          ? createHash("sha256").update("5512345678").digest("hex")
          : null,
      phoneLast4: method === "pn" ? "5678" : null,
      createdAt,
      expiresAt:
        options.expiresAt === undefined
          ? new Date(createdAt.getTime() + 600_000)
          : options.expiresAt,
    })
    .returning();

  if (options.paidAt || options.status === "incident") {
    const counter =
      method === "counter"
        ? await db
            .insert(counterQrs)
            .values({
              merchantId,
              status: "ready",
              peyQrId: `counter-${randomUUID()}`,
              numRef: 0,
              qrPayload: `COBRAVOZ-MOCK|counter|${merchantId}|${charge.id}`,
              concept: "Transferencia",
            })
            .onConflictDoNothing({ target: counterQrs.merchantId })
            .returning()
            .then(async (rows) => {
              if (rows[0]) return rows[0];
              const [existing] = await db
                .select()
                .from(counterQrs)
                .where(eq(counterQrs.merchantId, merchantId));
              return existing;
            })
        : null;
    const instrument =
      method === "counter"
        ? counter
        : method === "pn"
          ? await db
              .insert(codiNotifications)
              .values({
                chargeId: charge.id,
                peyTransactionId: `pn-${randomUUID()}`,
                codiId: randomUUID().replaceAll("-", "").slice(0, 20),
                numRef: 123456,
                phoneLast4: "5678",
                expiresAt: new Date(createdAt.getTime() + 600_000),
              })
              .returning()
              .then((rows) => rows[0])
          : method === "link"
            ? await db
                .insert(paymentLinks)
                .values({
                  chargeId: charge.id,
                  peyPaymentLinkId: `link-${randomUUID()}`,
                  url: `https://app.mipey.mx/payment-link/${charge.id}`,
                  expiresAt: new Date(createdAt.getTime() + 600_000),
                })
                .returning()
                .then((rows) => rows[0])
            : await db
                .insert(codiQrs)
                .values({
                  chargeId: charge.id,
                  peyQrId: `qr-${randomUUID()}`,
                  numRef: 123456,
                  qrPayload: `COBRAVOZ-MOCK|${charge.id}`,
                  expiresAt: new Date(createdAt.getTime() + 600_000),
                })
                .returning()
                .then((rows) => rows[0]);
    if (!instrument) throw new Error("setup");
    if (options.paidAt || options.reconciliationStatus) {
      const reconciled =
        (options.reconciliationStatus ?? "reconciled") === "reconciled";
      const [payment] = await db
        .insert(payments)
        .values({
          codiQrId: method === "qr" ? instrument.id : null,
          codiNotificationId: method === "pn" ? instrument.id : null,
          paymentLinkId: method === "link" ? instrument.id : null,
          counterQrId: method === "counter" ? instrument.id : null,
          chargeId: method === "counter" ? charge.id : null,
          providerTransactionId: `tx-${randomUUID()}`,
          amountCents: options.receivedCents ?? amountCents,
          reconciliationStatus: reconciled ? "reconciled" : "incident",
          evidenceSource: "webhook",
          paidAt: options.paidAt ?? createdAt,
          recordedAt: NOON,
          reconciledAt: reconciled ? NOON : null,
        })
        .returning();
      if (reconciled) {
        await db
          .update(charges)
          .set({ status: "paid", paidPaymentId: payment.id })
          .where(eq(charges.id, charge.id));
      } else {
        await db
          .update(charges)
          .set({ status: "incident" })
          .where(eq(charges.id, charge.id));
      }
    }
  } else if (options.status && options.status !== "waiting_payment") {
    await db
      .update(charges)
      .set({ status: options.status })
      .where(eq(charges.id, charge.id));
  }

  return charge.id;
}

afterEach(async () => {
  if (merchantIds.length === 0) return;
  const rows = await db
    .select({ id: charges.id })
    .from(charges)
    .where(inArray(charges.merchantId, merchantIds));
  const chargeIds = rows.map((row) => row.id);
  if (chargeIds.length > 0) {
    const qrRows = await db
      .select({ id: codiQrs.id })
      .from(codiQrs)
      .where(inArray(codiQrs.chargeId, chargeIds));
    const qrIds = qrRows.map((row) => row.id);
    const noteRows = await db
      .select({ id: codiNotifications.id })
      .from(codiNotifications)
      .where(inArray(codiNotifications.chargeId, chargeIds));
    const noteIds = noteRows.map((row) => row.id);
    await db
      .update(charges)
      .set({ status: "created", paidPaymentId: null })
      .where(inArray(charges.id, chargeIds));
    if (qrIds.length > 0) {
      await db.delete(payments).where(inArray(payments.codiQrId, qrIds));
      await db.delete(codiQrs).where(inArray(codiQrs.id, qrIds));
    }
    if (noteIds.length > 0) {
      await db
        .delete(payments)
        .where(inArray(payments.codiNotificationId, noteIds));
      await db
        .delete(codiNotifications)
        .where(inArray(codiNotifications.id, noteIds));
    }
    const linkRows = await db
      .select({ id: paymentLinks.id })
      .from(paymentLinks)
      .where(inArray(paymentLinks.chargeId, chargeIds));
    const linkIds = linkRows.map((row) => row.id);
    if (linkIds.length > 0) {
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

describe("getDailySummary", () => {
  it("suma solo pagos conciliados del día comercial, no el del aviso", async () => {
    const merchant = await newMerchant();
    await addCharge(merchant.id, {
      amountCents: 10000,
      paidAt: new Date("2026-11-15T06:30:00.000Z"),
    });
    await addCharge(merchant.id, {
      amountCents: 5000,
      paidAt: new Date("2026-11-15T05:30:00.000Z"),
    });
    await addCharge(merchant.id, {
      amountCents: 2500,
      reconciliationStatus: "incident",
      paidAt: new Date("2026-11-15T20:00:00.000Z"),
    });
    await addCharge(merchant.id, { status: "waiting_payment" });

    const summary = await getDailySummary({ db, now: () => NOON }, merchant.id);

    expect(summary).toEqual({ totalCents: 10000, count: 1 });
  });

  it("no incluye los pagos de otro comercio", async () => {
    const owner = await newMerchant();
    const other = await newMerchant();
    await addCharge(other.id, {
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });

    const summary = await getDailySummary({ db, now: () => NOON }, owner.id);

    expect(summary).toEqual({ totalCents: 0, count: 0 });
  });

  it("suma el pago conciliado de una notificación junto al del QR", async () => {
    const merchant = await newMerchant();
    const other = await newMerchant();
    await addCharge(merchant.id, {
      amountCents: 10000,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });
    await addCharge(merchant.id, {
      method: "pn",
      amountCents: 15050,
      receivedCents: 1,
      paidAt: new Date("2026-11-15T18:30:00.000Z"),
    });
    await addCharge(merchant.id, {
      method: "pn",
      amountCents: 8000,
      reconciliationStatus: "incident",
      paidAt: new Date("2026-11-15T19:00:00.000Z"),
    });
    await addCharge(other.id, {
      method: "pn",
      receivedCents: 1,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });

    const summary = await getDailySummary({ db, now: () => NOON }, merchant.id);

    expect(summary).toEqual({ totalCents: 10001, count: 2 });
  });

  it("suma el dinero liquidado de un enlace", async () => {
    const merchant = await newMerchant();
    await addCharge(merchant.id, {
      method: "link",
      amountCents: 10000,
      receivedCents: 11850,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });
    await addCharge(merchant.id, {
      method: "link",
      amountCents: 5000,
      reconciliationStatus: "incident",
      paidAt: new Date("2026-11-15T19:00:00.000Z"),
    });

    const summary = await getDailySummary({ db, now: () => NOON }, merchant.id);

    expect(summary).toEqual({ totalCents: 11850, count: 1 });
  });

  it("suma el importe que el cliente escribió en el QR de mostrador", async () => {
    const merchant = await newMerchant();
    await addCharge(merchant.id, {
      method: "counter",
      amountCents: 25000,
      receivedCents: 25000,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });
    await addCharge(merchant.id, {
      method: "counter",
      amountCents: 4000,
      receivedCents: 4000,
      paidAt: new Date("2026-11-15T18:10:00.000Z"),
    });

    const summary = await getDailySummary({ db, now: () => NOON }, merchant.id);
    const page = await listMovements({ db, now: () => NOON }, merchant.id);

    expect(summary).toEqual({ totalCents: 29000, count: 2 });
    expect(
      page.ok &&
        page.movements.every((row) => row.methodLabel === "QR de mostrador"),
    ).toBe(true);
  });
});

describe("listMovements", () => {
  it("ordena por la fecha del pago y pagina sin mezclar comercios", async () => {
    const merchant = await newMerchant();
    const other = await newMerchant();
    const older = await addCharge(merchant.id, {
      createdAt: new Date("2026-11-15T12:00:00.000Z"),
      paidAt: new Date("2026-11-14T18:00:00.000Z"),
      amountCents: 1000,
    });
    const newer = await addCharge(merchant.id, {
      createdAt: new Date("2026-11-10T12:00:00.000Z"),
      paidAt: new Date("2026-11-15T20:00:00.000Z"),
      amountCents: 2000,
    });
    const pending = await addCharge(merchant.id, {
      createdAt: new Date("2026-11-15T16:00:00.000Z"),
      status: "waiting_payment",
      expiresAt: new Date("2026-11-15T22:00:00.000Z"),
    });
    await addCharge(other.id, {
      paidAt: new Date("2026-11-15T21:00:00.000Z"),
    });

    const first = await listMovements({ db, now: () => NOON }, merchant.id, {
      limit: 2,
    });
    if (!first.ok) throw new Error("cursor");
    expect(first.movements.map((row) => row.id)).toEqual([newer, pending]);
    expect(first.movements[1].status).toBe("waiting_payment");

    const second = await listMovements({ db, now: () => NOON }, merchant.id, {
      limit: 2,
      cursor: first.nextCursor,
    });
    if (!second.ok) throw new Error("cursor");
    expect(second.movements.map((row) => row.id)).toEqual([older]);
    expect(second.nextCursor).toBeNull();
  });

  it("un cobro en espera ya vencido se lista como expirado y no suma", async () => {
    const merchant = await newMerchant();
    const id = await addCharge(merchant.id, {
      status: "waiting_payment",
      expiresAt: new Date("2026-11-15T17:00:00.000Z"),
    });

    const page = await listMovements({ db, now: () => NOON }, merchant.id);
    const summary = await getDailySummary({ db, now: () => NOON }, merchant.id);

    expect(page.ok && page.movements[0]).toMatchObject({
      id,
      status: "expired",
    });
    expect(summary).toEqual({ totalCents: 0, count: 0 });
  });

  it("rechaza un cursor mal formado", async () => {
    const merchant = await newMerchant();
    const page = await listMovements({ db }, merchant.id, {
      cursor: "no-es-un-cursor",
    });
    expect(page).toEqual({ ok: false, error: "invalid_cursor" });
  });
});

describe("getMovementDetail", () => {
  it("muestra solicitado y recibido solo cuando el pago está conciliado", async () => {
    const merchant = await newMerchant();
    const paid = await addCharge(merchant.id, {
      amountCents: 15050,
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });
    const incident = await addCharge(merchant.id, {
      amountCents: 8000,
      reconciliationStatus: "incident",
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });

    const paidDetail = await getMovementDetail({ db }, merchant.id, paid);
    const incidentDetail = await getMovementDetail(
      { db },
      merchant.id,
      incident,
    );

    expect(paidDetail).toMatchObject({
      status: "paid",
      requestedCents: 15050,
      receivedCents: 15050,
    });
    expect(paidDetail?.paidLabel).toBeTruthy();
    expect(incidentDetail).toMatchObject({
      status: "incident",
      requestedCents: 8000,
      receivedCents: null,
      paidLabel: null,
    });
  });

  it("muestra el importe capturado y suma solo el centavo recibido", async () => {
    const merchant = await newMerchant();
    const id = await addCharge(merchant.id, {
      amountCents: 15050,
      receivedCents: 1,
      paidAt: NOON,
    });

    const summary = await getDailySummary({ db, now: () => NOON }, merchant.id);
    const page = await listMovements({ db, now: () => NOON }, merchant.id);
    const detail = await getMovementDetail({ db }, merchant.id, id);

    expect(summary).toEqual({ totalCents: 1, count: 1 });
    expect(page.ok && page.movements[0].amountCents).toBe(15050);
    expect(detail).toMatchObject({
      requestedCents: 15050,
      receivedCents: 1,
    });
  });

  it("un movimiento de otro comercio no se encuentra", async () => {
    const owner = await newMerchant();
    const intruder = await newMerchant();
    const id = await addCharge(owner.id, {
      paidAt: new Date("2026-11-15T18:00:00.000Z"),
    });

    expect(await getMovementDetail({ db }, intruder.id, id)).toBeNull();
  });
});
