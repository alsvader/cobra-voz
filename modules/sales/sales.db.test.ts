import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { charges, codiQrs, merchants, payments } from "@/adapters/db/schema";
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
  } = {},
) {
  const amountCents = options.amountCents ?? 15050;
  const createdAt = options.createdAt ?? NOON;
  const [charge] = await db
    .insert(charges)
    .values({
      merchantId,
      amountCents,
      idempotencyKey: randomUUID(),
      status: "waiting_payment",
      createdAt,
      expiresAt:
        options.expiresAt === undefined
          ? new Date(createdAt.getTime() + 600_000)
          : options.expiresAt,
    })
    .returning();

  if (options.paidAt || options.status === "incident") {
    const [qr] = await db
      .insert(codiQrs)
      .values({
        chargeId: charge.id,
        peyQrId: `qr-${randomUUID()}`,
        numRef: 123456,
        qrPayload: `COBRAVOZ-MOCK|${charge.id}`,
        expiresAt: new Date(createdAt.getTime() + 600_000),
      })
      .returning();
    if (options.paidAt || options.reconciliationStatus) {
      const reconciled =
        (options.reconciliationStatus ?? "reconciled") === "reconciled";
      const [payment] = await db
        .insert(payments)
        .values({
          codiQrId: qr.id,
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
    await db
      .update(charges)
      .set({ status: "created", paidPaymentId: null })
      .where(inArray(charges.id, chargeIds));
    if (qrIds.length > 0) {
      await db.delete(payments).where(inArray(payments.codiQrId, qrIds));
      await db.delete(codiQrs).where(inArray(codiQrs.id, qrIds));
    }
    await db.delete(charges).where(inArray(charges.id, chargeIds));
  }
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
