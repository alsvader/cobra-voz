import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  charges,
  codiNotifications,
  codiQrs,
  merchants,
  paymentIncidents,
  paymentLinks,
  payments,
} from "@/adapters/db/schema";
import { createTestDb } from "@/adapters/db/testing";
import {
  MOCK_QR_PREFIX,
  MOCK_UNCERTAIN_AMOUNT_CENTS,
  createMockPeyAdapter,
} from "@/adapters/pey/mock";
import type { CreateQrOutcome, PeyAdapter } from "@/adapters/pey/types";
import {
  STALE_CREATED_MS,
  closeCharge,
  createCharge,
  findResumableCharge,
  getCharge,
} from "./service";

const { db, close } = createTestDb();
const merchantIds: string[] = [];

async function newMerchant() {
  const [merchant] = await db
    .insert(merchants)
    .values({
      name: "Comercio de pruebas de cobros",
      peyBankAccountId: `acct-${randomUUID()}`,
    })
    .returning();
  merchantIds.push(merchant.id);
  return merchant;
}

const newKey = () => randomUUID();

/** Adaptador de prueba con resultado programable y registro de llamadas. */
function adapterReturning(
  produce: () => Promise<CreateQrOutcome> | CreateQrOutcome,
) {
  const calls: unknown[] = [];
  const adapter: PeyAdapter = {
    kind: "mock",
    async createCounterQr() {
      return {
        status: "uncertain",
        reason: "Esta prueba no crea el QR de mostrador.",
      };
    },
    async createCodiQr(request) {
      calls.push(request);
      return produce();
    },
    async queryCodiQrPayments() {
      return {
        status: "unavailable",
        reason: "Esta prueba no consulta pagos.",
      };
    },
    async createCodiPush() {
      return {
        status: "uncertain",
        reason: "Esta prueba no envía notificaciones.",
      };
    },
    async queryCodiPushPayment() {
      return {
        status: "unavailable",
        reason: "Esta prueba no consulta notificaciones.",
      };
    },
    async createPaymentLink() {
      return {
        status: "rejected",
        errorType: "INVALID_REQUEST",
      };
    },
    async queryPaymentLink() {
      return {
        status: "unavailable",
        reason: "Esta prueba no consulta enlaces.",
      };
    },
  };
  return { adapter, calls };
}

const futureDate = () => new Date(Date.now() + 600_000);

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
    if (linkRows.length > 0) {
      await db.delete(payments).where(
        inArray(
          payments.paymentLinkId,
          linkRows.map((row) => row.id),
        ),
      );
      await db
        .delete(paymentLinks)
        .where(inArray(paymentLinks.chargeId, chargeIds));
    }
    await db.delete(charges).where(inArray(charges.id, chargeIds));
  }
  await db.delete(merchants).where(inArray(merchants.id, merchantIds));
  merchantIds.length = 0;
});
afterAll(close);

describe("createCharge — camino feliz", () => {
  it("persiste la intención ANTES de llamar a Pey", async () => {
    const merchant = await newMerchant();
    let statusSeenByPey: string | undefined;
    const { adapter } = adapterReturning(async () => {
      const [row] = await db
        .select({ status: charges.status })
        .from(charges)
        .where(eq(charges.merchantId, merchant.id));
      statusSeenByPey = row?.status;
      return {
        status: "created",
        peyQrId: `qr-${randomUUID()}`,
        qrString: "payload",
        expiresAt: futureDate(),
      };
    });

    await createCharge({ db, pey: adapter }, merchant.id, {
      amountCents: 15050,
      idempotencyKey: newKey(),
    });

    expect(statusSeenByPey).toBe("created");
  });

  it("deja el cobro en waiting_payment con QR persistido y vigencia de 600 s", async () => {
    const merchant = await newMerchant();
    const now = new Date("2026-11-15T12:00:00Z");
    const pey = createMockPeyAdapter({ now: () => now });

    const result = await createCharge(
      { db, pey, now: () => now },
      merchant.id,
      { amountCents: 15050, idempotencyKey: newKey() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replayed).toBe(false);
    expect(result.charge).toMatchObject({
      amountCents: 15050,
      currency: "MXN",
      status: "waiting_payment",
      expiresAt: "2026-11-15T12:10:00.000Z",
    });
    expect(result.charge.reference).toMatch(/^CV-[0-9A-F]{8}$/);
    expect(result.charge.qr?.payload.startsWith(MOCK_QR_PREFIX)).toBe(true);
    expect(result.charge.qr?.simulated).toBe(true);

    const [qr] = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, result.charge.id));
    expect(qr.peyQrId).toMatch(/^mock-qr-/);
    expect(qr.numRef).toBeGreaterThanOrEqual(0);
    expect(qr.numRef).toBeLessThanOrEqual(9_999_999);
  });

  it("envía a Pey los datos correctos (centavos, concepto, cuenta, 600 s)", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();

    const result = await createCharge({ db, pey }, merchant.id, {
      amountCents: 29,
      idempotencyKey: newKey(),
    });

    expect(pey.calls).toHaveLength(1);
    expect(pey.calls[0]).toMatchObject({
      amountCents: 29,
      expirationSeconds: 600,
      bankAccountId: merchant.peyBankAccountId,
    });
    expect(result.ok && pey.calls[0].chargeId).toBe(
      result.ok ? result.charge.id : "",
    );
    expect(pey.calls[0].concept).toMatch(/^Cobro CV-/);
  });

  it("el DTO no expone merchantId, pey_qr_id ni numRef", async () => {
    const merchant = await newMerchant();
    const result = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 100, idempotencyKey: newKey() },
    );
    const json = JSON.stringify(result);

    expect(json).not.toContain(merchant.id);
    expect(json).not.toContain("mock-qr-");
    expect(json).not.toMatch(/numRef|peyQrId|merchantId|bankAccount/);
  });
});

describe("createCharge — idempotencia", () => {
  it("repetir la misma intención devuelve el mismo cobro y no llama otra vez a Pey", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const input = { amountCents: 15000, idempotencyKey: newKey() };

    const first = await createCharge({ db, pey }, merchant.id, input);
    const second = await createCharge({ db, pey }, merchant.id, input);
    const third = await createCharge({ db, pey }, merchant.id, input);

    expect(first.ok && second.ok && third.ok).toBe(true);
    if (!first.ok || !second.ok || !third.ok) return;
    expect(second.charge.id).toBe(first.charge.id);
    expect(third.charge).toEqual(second.charge);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(pey.calls).toHaveLength(1);

    const rows = await db
      .select()
      .from(charges)
      .where(eq(charges.merchantId, merchant.id));
    expect(rows).toHaveLength(1);
  });

  it("peticiones SIMULTÁNEAS con la misma clave crean un solo cobro y una sola llamada a Pey", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter({ latencyMs: 50 });
    const input = { amountCents: 15000, idempotencyKey: newKey() };

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createCharge({ db, pey }, merchant.id, input),
      ),
    );

    const okResults = results.flatMap((r) => (r.ok ? [r] : []));
    expect(okResults).toHaveLength(10);
    expect(new Set(okResults.map((r) => r.charge.id)).size).toBe(1);
    expect(okResults.filter((r) => !r.replayed)).toHaveLength(1);
    expect(pey.calls).toHaveLength(1);

    const rows = await db
      .select()
      .from(charges)
      .where(eq(charges.merchantId, merchant.id));
    expect(rows).toHaveLength(1);
    const qrs = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, rows[0].id));
    expect(qrs).toHaveLength(1);
  });

  it("misma clave con OTRO importe es un conflicto y no crea nada", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const idempotencyKey = newKey();
    await createCharge({ db, pey }, merchant.id, {
      amountCents: 15000,
      idempotencyKey,
    });

    const conflict = await createCharge({ db, pey }, merchant.id, {
      amountCents: 99900,
      idempotencyKey,
    });

    expect(conflict).toEqual({ ok: false, error: "idempotency_conflict" });
    expect(pey.calls).toHaveLength(1);
    const rows = await db
      .select()
      .from(charges)
      .where(eq(charges.merchantId, merchant.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(15000);
  });

  it("intenciones distintas (claves distintas) son cobros distintos", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();

    const a = await createCharge({ db, pey }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });
    const b = await createCharge({ db, pey }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });

    expect(a.ok && b.ok && a.charge.id !== b.charge.id).toBe(true);
    expect(pey.calls).toHaveLength(2);
  });

  it("la clave es por comercio: la misma clave en otro comercio no choca", async () => {
    const merchantA = await newMerchant();
    const merchantB = await newMerchant();
    const pey = createMockPeyAdapter();
    const idempotencyKey = newKey();

    const a = await createCharge({ db, pey }, merchantA.id, {
      amountCents: 15000,
      idempotencyKey,
    });
    const b = await createCharge({ db, pey }, merchantB.id, {
      amountCents: 15000,
      idempotencyKey,
    });

    expect(a.ok && b.ok && !b.replayed && a.charge.id !== b.charge.id).toBe(
      true,
    );
  });

  it("un comercio inexistente no crea cobros ni llama a Pey", async () => {
    const pey = createMockPeyAdapter();

    const result = await createCharge(
      { db, pey },
      "00000000-0000-4000-8000-0000000000fd",
      { amountCents: 15000, idempotencyKey: newKey() },
    );

    expect(result).toEqual({ ok: false, error: "merchant_not_found" });
    expect(pey.calls).toHaveLength(0);
  });
});

describe("createCharge — resultado incierto (sin reintento ciego)", () => {
  it("timeout simulado: qr_uncertain, sin QR, con incidencia abierta", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();

    const result = await createCharge({ db, pey }, merchant.id, {
      amountCents: MOCK_UNCERTAIN_AMOUNT_CENTS,
      idempotencyKey: newKey(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.charge.status).toBe("qr_uncertain");
    expect(result.charge.qr).toBeNull();

    const qrs = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, result.charge.id));
    expect(qrs).toHaveLength(0);

    const incidents = await db
      .select()
      .from(paymentIncidents)
      .where(eq(paymentIncidents.chargeId, result.charge.id));
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      type: "qr_creation_uncertain",
      status: "open",
    });
  });

  it("repetir la petición NO vuelve a llamar a Pey ni crea otro cobro/incidencia", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const input = {
      amountCents: MOCK_UNCERTAIN_AMOUNT_CENTS,
      idempotencyKey: newKey(),
    };

    const first = await createCharge({ db, pey }, merchant.id, input);
    const retry = await createCharge({ db, pey }, merchant.id, input);

    expect(first.ok && retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(retry.charge.id).toBe(first.charge.id);
    expect(retry.charge.status).toBe("qr_uncertain");
    expect(retry.replayed).toBe(true);
    expect(pey.calls).toHaveLength(1);

    const incidents = await db
      .select()
      .from(paymentIncidents)
      .where(eq(paymentIncidents.chargeId, first.charge.id));
    expect(incidents).toHaveLength(1);
  });

  it("si el adaptador lanza una excepción también queda incierto", async () => {
    const merchant = await newMerchant();
    const { adapter, calls } = adapterReturning(() => {
      throw new Error("socket hang up");
    });

    const result = await createCharge({ db, pey: adapter }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });

    expect(result.ok && result.charge.status).toBe("qr_uncertain");
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["sin id", { peyQrId: "  ", qrString: "x", expiresAt: futureDate() }],
    [
      "sin qrString",
      { peyQrId: "id-1", qrString: "", expiresAt: futureDate() },
    ],
    [
      "con vigencia vencida",
      {
        peyQrId: "id-1",
        qrString: "x",
        expiresAt: new Date(Date.now() - 1000),
      },
    ],
    [
      "con vigencia inválida",
      { peyQrId: "id-1", qrString: "x", expiresAt: new Date("nope") },
    ],
  ])(
    "una respuesta «creada» %s no se acepta como QR real",
    async (_name, qr) => {
      const merchant = await newMerchant();
      const { adapter } = adapterReturning(() => ({
        status: "created",
        ...qr,
      }));

      const result = await createCharge({ db, pey: adapter }, merchant.id, {
        amountCents: 15000,
        idempotencyKey: newKey(),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.charge.status).toBe("qr_uncertain");
      expect(result.charge.qr).toBeNull();
      const qrs = await db
        .select()
        .from(codiQrs)
        .where(eq(codiQrs.chargeId, result.charge.id));
      expect(qrs).toHaveLength(0);
    },
  );

  it("si el QR no se puede persistir, no se expone y queda incierto", async () => {
    const merchant = await newMerchant();
    const duplicatedPeyId = `qr-${randomUUID()}`;
    const { adapter } = adapterReturning(() => ({
      status: "created",
      peyQrId: duplicatedPeyId,
      qrString: "payload",
      expiresAt: futureDate(),
    }));

    const first = await createCharge({ db, pey: adapter }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });
    // Mismo pey_qr_id: viola la unicidad al persistir.
    const second = await createCharge({ db, pey: adapter }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });

    expect(first.ok && first.charge.status).toBe("waiting_payment");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.charge.status).toBe("qr_uncertain");
    expect(second.charge.qr).toBeNull();
  });
});

describe("referencia numérica (numRef)", () => {
  it("evita reutilizar un numRef de un QR todavía vigente", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const sequence = [4321, 4321, 7777];
    const nextNumRef = () => sequence.shift() ?? 1;

    const a = await createCharge({ db, pey, nextNumRef }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });
    const b = await createCharge({ db, pey, nextNumRef }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });

    expect(a.ok && b.ok).toBe(true);
    expect(pey.calls.map((call) => call.numRef)).toEqual([4321, 7777]);
  });

  it("puede reutilizarse cuando el QR anterior ya venció", async () => {
    const merchant = await newMerchant();
    const first = await createCharge(
      { db, pey: createMockPeyAdapter(), nextNumRef: () => 555 },
      merchant.id,
      { amountCents: 15000, idempotencyKey: newKey() },
    );
    if (!first.ok) throw new Error("setup");
    // Vence el QR anterior (solo el de este cobro).
    await db
      .update(codiQrs)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(codiQrs.chargeId, first.charge.id));

    const pey = createMockPeyAdapter();
    await createCharge({ db, pey, nextNumRef: () => 555 }, merchant.id, {
      amountCents: 15000,
      idempotencyKey: newKey(),
    });

    expect(pey.calls[0].numRef).toBe(555);
  });
});

describe("getCharge — alcance por comercio y cobros sin resolver", () => {
  it("devuelve el cobro del propio comercio", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 15000, idempotencyKey: newKey() },
    );
    if (!created.ok) throw new Error("setup");

    const found = await getCharge({ db }, merchant.id, created.charge.id);

    expect(found).toEqual(created.charge);
  });

  it("un cobro de OTRO comercio no se puede leer", async () => {
    const owner = await newMerchant();
    const intruder = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      owner.id,
      { amountCents: 15000, idempotencyKey: newKey() },
    );
    if (!created.ok) throw new Error("setup");

    expect(await getCharge({ db }, intruder.id, created.charge.id)).toBeNull();
    expect(
      await getCharge({ db }, owner.id, "00000000-0000-4000-8000-0000000000fc"),
    ).toBeNull();
  });

  it("un cobro 'created' reciente se mantiene (generando QR)", async () => {
    const merchant = await newMerchant();
    const [row] = await db
      .insert(charges)
      .values({
        merchantId: merchant.id,
        amountCents: 15000,
        idempotencyKey: newKey(),
      })
      .returning();

    const found = await getCharge({ db }, merchant.id, row.id);

    expect(found?.status).toBe("created");
  });

  it("un cobro 'created' que quedó sin resolver pasa a qr_uncertain (sin llamar a Pey)", async () => {
    const merchant = await newMerchant();
    const [row] = await db
      .insert(charges)
      .values({
        merchantId: merchant.id,
        amountCents: 15000,
        idempotencyKey: newKey(),
      })
      .returning();
    const later = new Date(row.createdAt.getTime() + STALE_CREATED_MS + 1000);

    const found = await getCharge(
      { db, now: () => later },
      merchant.id,
      row.id,
    );
    // Idempotente: una segunda lectura no duplica la incidencia.
    await getCharge({ db, now: () => later }, merchant.id, row.id);

    expect(found?.status).toBe("qr_uncertain");
    const incidents = await db
      .select()
      .from(paymentIncidents)
      .where(eq(paymentIncidents.chargeId, row.id));
    expect(incidents).toHaveLength(1);
  });

  it("repetir la petición de un 'created' vencido tampoco crea un QR nuevo", async () => {
    const merchant = await newMerchant();
    const idempotencyKey = newKey();
    const [row] = await db
      .insert(charges)
      .values({ merchantId: merchant.id, amountCents: 15000, idempotencyKey })
      .returning();
    const later = new Date(row.createdAt.getTime() + STALE_CREATED_MS + 1000);
    const pey = createMockPeyAdapter();

    const result = await createCharge(
      { db, pey, now: () => later },
      merchant.id,
      { amountCents: 15000, idempotencyKey },
    );

    expect(result.ok && result.charge.status).toBe("qr_uncertain");
    expect(result.ok && result.replayed).toBe(true);
    expect(pey.calls).toHaveLength(0);
  });
});

/** Cobro `waiting_payment` creado a las 12:00 UTC con QR de prueba (600 s). */
const T0 = new Date("2026-11-15T12:00:00Z");
const at = (secondsAfterT0: number) =>
  new Date(T0.getTime() + secondsAfterT0 * 1000);

async function waitingCharge(merchantId: string) {
  const result = await createCharge(
    { db, pey: createMockPeyAdapter({ now: () => T0 }), now: () => T0 },
    merchantId,
    { amountCents: 15050, idempotencyKey: newKey() },
  );
  if (!result.ok || result.charge.status !== "waiting_payment") {
    throw new Error("setup: se esperaba un cobro waiting_payment");
  }
  return result.charge;
}

/** Pago verificado asociado al QR (lo registrará PR-07; aquí solo prepara el estado). */
async function insertPayment(codiQrId: string) {
  const [payment] = await db
    .insert(payments)
    .values({
      codiQrId,
      providerTransactionId: `tx-${randomUUID()}`,
      amountCents: 15050,
      reconciliationStatus: "reconciled",
      evidenceSource: "webhook",
      paidAt: T0,
      reconciledAt: T0,
    })
    .returning();
  return payment;
}

async function rowOf(chargeId: string) {
  const [row] = await db.select().from(charges).where(eq(charges.id, chargeId));
  return row;
}

describe("vencimiento por tiempo (lo decide el servidor al leer)", () => {
  it("antes de vencer sigue esperando pago, con su QR", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);

    const found = await getCharge(
      { db, now: () => at(599) },
      merchant.id,
      charge.id,
    );

    expect(found?.status).toBe("waiting_payment");
    expect(found?.qr).not.toBeNull();
  });

  it("al llegar a expiresAt pasa a expired y queda persistido", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);

    const found = await getCharge(
      { db, now: () => at(600) },
      merchant.id,
      charge.id,
    );

    expect(found?.status).toBe("expired");
    expect((await rowOf(charge.id)).status).toBe("expired");
  });

  it("expirar conserva el QR y el cobro: un pago tardío aún puede conciliarse", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);

    await getCharge({ db, now: () => at(3600) }, merchant.id, charge.id);

    const qrs = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, charge.id));
    expect(qrs).toHaveLength(1);
    expect(qrs[0].qrPayload).toBe(charge.qr?.payload);
  });

  it("repetir la petición de un cobro vencido no crea otro QR ni llama a Pey", async () => {
    const merchant = await newMerchant();
    const idempotencyKey = newKey();
    const pey = createMockPeyAdapter({ now: () => T0 });
    await createCharge({ db, pey, now: () => T0 }, merchant.id, {
      amountCents: 15050,
      idempotencyKey,
    });

    const again = await createCharge(
      { db, pey, now: () => at(900) },
      merchant.id,
      {
        amountCents: 15050,
        idempotencyKey,
      },
    );

    expect(again.ok && again.charge.status).toBe("expired");
    expect(pey.calls).toHaveLength(1);
  });

  it("no toca cobros que ya están pagados, cerrados o inciertos", async () => {
    const merchant = await newMerchant();

    const paid = await waitingCharge(merchant.id);
    const [qr] = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, paid.id));
    const payment = await insertPayment(qr.id);
    await db
      .update(charges)
      .set({ status: "paid", paidPaymentId: payment.id })
      .where(eq(charges.id, paid.id));

    const closed = await waitingCharge(merchant.id);
    await closeCharge({ db, now: () => at(10) }, merchant.id, closed.id);

    const [uncertain] = await db
      .insert(charges)
      .values({
        merchantId: merchant.id,
        amountCents: 1301,
        idempotencyKey: newKey(),
        status: "qr_uncertain",
      })
      .returning();

    const later = { db, now: () => at(7200) };
    expect((await getCharge(later, merchant.id, paid.id))?.status).toBe("paid");
    expect((await getCharge(later, merchant.id, closed.id))?.status).toBe(
      "locally_closed",
    );
    expect((await getCharge(later, merchant.id, uncertain.id))?.status).toBe(
      "qr_uncertain",
    );
  });
});

describe("closeCharge — cierre LOCAL", () => {
  it("cierra un cobro que espera pago: locally_closed con closedAt, sin borrar el QR", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);

    const result = await closeCharge(
      { db, now: () => at(30) },
      merchant.id,
      charge.id,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyClosed).toBe(false);
    expect(result.charge.status).toBe("locally_closed");
    expect(result.charge.closedAt).toBe(at(30).toISOString());
    const qrs = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, charge.id));
    expect(qrs).toHaveLength(1);
    expect((await rowOf(charge.id)).closedAt).toEqual(at(30));
  });

  it("es idempotente: cerrar de nuevo no cambia closedAt", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);
    await closeCharge({ db, now: () => at(30) }, merchant.id, charge.id);

    const again = await closeCharge(
      { db, now: () => at(90) },
      merchant.id,
      charge.id,
    );

    expect(again.ok && again.alreadyClosed).toBe(true);
    expect(again.ok && again.charge.closedAt).toBe(at(30).toISOString());
  });

  it("cierres simultáneos: todos terminan cerrados y solo uno lo ejecuta", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        closeCharge({ db, now: () => at(30) }, merchant.id, charge.id),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && !r.alreadyClosed)).toHaveLength(1);
  });

  it("un cobro de OTRO comercio o inexistente es not_found y no se modifica", async () => {
    const owner = await newMerchant();
    const intruder = await newMerchant();
    const charge = await waitingCharge(owner.id);

    const foreign = await closeCharge({ db }, intruder.id, charge.id);
    const missing = await closeCharge({ db }, owner.id, randomUUID());

    expect(foreign).toEqual({ ok: false, error: "not_found" });
    expect(missing).toEqual({ ok: false, error: "not_found" });
    expect((await rowOf(charge.id)).status).toBe("waiting_payment");
  });

  it("un cobro ya vencido NO se cierra: devuelve su estado real (expired)", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);

    const result = await closeCharge(
      { db, now: () => at(601) },
      merchant.id,
      charge.id,
    );

    expect(result.ok).toBe(false);
    if (result.ok || result.error !== "not_closable")
      throw new Error("esperado not_closable");
    expect(result.charge.status).toBe("expired");
    expect((await rowOf(charge.id)).closedAt).toBeNull();
  });

  it("un cobro pagado NO se puede cerrar: gana el pago", async () => {
    const merchant = await newMerchant();
    const charge = await waitingCharge(merchant.id);
    const [qr] = await db
      .select()
      .from(codiQrs)
      .where(eq(codiQrs.chargeId, charge.id));
    const payment = await insertPayment(qr.id);
    await db
      .update(charges)
      .set({ status: "paid", paidPaymentId: payment.id })
      .where(eq(charges.id, charge.id));

    const result = await closeCharge(
      { db, now: () => at(30) },
      merchant.id,
      charge.id,
    );

    expect(result.ok).toBe(false);
    if (result.ok || result.error !== "not_closable")
      throw new Error("esperado not_closable");
    expect(result.charge.status).toBe("paid");
    expect((await rowOf(charge.id)).status).toBe("paid");
  });

  it("un cobro con QR incierto o aún generándose no se cierra", async () => {
    const merchant = await newMerchant();
    const [creating] = await db
      .insert(charges)
      .values({
        merchantId: merchant.id,
        amountCents: 100,
        idempotencyKey: newKey(),
      })
      .returning();
    const [uncertain] = await db
      .insert(charges)
      .values({
        merchantId: merchant.id,
        amountCents: 1301,
        idempotencyKey: newKey(),
        status: "qr_uncertain",
      })
      .returning();

    const a = await closeCharge({ db }, merchant.id, creating.id);
    const b = await closeCharge({ db }, merchant.id, uncertain.id);

    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect((await rowOf(creating.id)).status).toBe("created");
    expect((await rowOf(uncertain.id)).status).toBe("qr_uncertain");
  });
});

describe("findResumableCharge", () => {
  it("devuelve el cobro en curso más reciente y omite el que ya venció", async () => {
    const merchant = await newMerchant();
    const older = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 1000, idempotencyKey: newKey() },
    );
    const newer = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 2500, idempotencyKey: newKey() },
    );
    if (!older.ok || !newer.ok) throw new Error("setup");
    await db
      .update(charges)
      .set({ createdAt: new Date("2026-11-15T12:00:00.000Z") })
      .where(eq(charges.id, older.charge.id));
    await db
      .update(charges)
      .set({ createdAt: new Date("2026-11-15T12:05:00.000Z") })
      .where(eq(charges.id, newer.charge.id));

    const pending = await findResumableCharge({ db }, merchant.id);
    expect(pending?.id).toBe(newer.charge.id);
    expect(pending?.status).toBe("waiting_payment");

    await db
      .update(charges)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(charges.id, newer.charge.id));

    const after = await findResumableCharge({ db }, merchant.id);
    expect(after?.id).toBe(older.charge.id);
  });

  it("un cobro en espera ya vencido deja de ofrecerse y pasa a expirado", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 1000, idempotencyKey: newKey() },
    );
    if (!created.ok) throw new Error("setup");
    await db
      .update(charges)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(charges.id, created.charge.id));

    const pending = await findResumableCharge({ db }, merchant.id);

    expect(pending).toBeNull();
    expect((await rowOf(created.charge.id)).status).toBe("expired");
  });

  it("un QR incierto se puede retomar para conservar la referencia", async () => {
    const merchant = await newMerchant();
    const created = await createCharge(
      { db, pey: createMockPeyAdapter() },
      merchant.id,
      { amountCents: 1301, idempotencyKey: newKey() },
    );
    if (!created.ok) throw new Error("setup");

    const pending = await findResumableCharge({ db }, merchant.id);

    expect(pending?.status).toBe("qr_uncertain");
    expect(pending?.reference).toBe(created.charge.reference);
  });
});

describe("createCharge — notificación", () => {
  const phone = "5512345678";

  it("guarda el aviso sin el teléfono completo y sin QR", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const result = await createCharge({ db, pey }, merchant.id, {
      amountCents: 15050,
      idempotencyKey: newKey(),
      method: "pn",
      phoneNumber: "55 1234-5678",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.charge).toMatchObject({
      status: "waiting_payment",
      collectionMethod: "pn",
      phoneLast4: "5678",
      qr: null,
    });
    expect(JSON.stringify(result.charge)).not.toContain(phone);
    expect(pey.pushCalls).toHaveLength(1);
    expect(pey.pushCalls[0].phoneNumber).toBe(phone);
    expect(pey.calls).toHaveLength(0);

    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, result.charge.id));
    expect(row.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.phoneHash).not.toBe(phone);

    const notes = await db
      .select()
      .from(codiNotifications)
      .where(eq(codiNotifications.chargeId, result.charge.id));
    expect(notes).toHaveLength(1);
    expect(notes[0].peyTransactionId).toMatch(/^mock-pn-/);
    expect(notes[0].codiId).toMatch(/^[0-9]{20}$/);
  });

  it("repetir la misma intención no envía otro aviso; otro celular sí choca", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const idempotencyKey = newKey();
    const input = {
      amountCents: 15050,
      idempotencyKey,
      method: "pn" as const,
      phoneNumber: phone,
    };
    const first = await createCharge({ db, pey }, merchant.id, input);
    const second = await createCharge({ db, pey }, merchant.id, input);
    const conflict = await createCharge({ db, pey }, merchant.id, {
      ...input,
      phoneNumber: "5587654321",
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.replayed).toBe(true);
    expect(second.charge.id).toBe(first.charge.id);
    expect(pey.pushCalls).toHaveLength(1);
    expect(conflict).toEqual({ ok: false, error: "idempotency_conflict" });
  });

  it("un timeout no reintenta el aviso", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const input = {
      amountCents: 1301,
      idempotencyKey: newKey(),
      method: "pn" as const,
      phoneNumber: phone,
    };
    const first = await createCharge({ db, pey }, merchant.id, input);
    const retry = await createCharge({ db, pey }, merchant.id, input);

    expect(first.ok && retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(first.charge.status).toBe("qr_uncertain");
    expect(retry.replayed).toBe(true);
    expect(pey.pushCalls).toHaveLength(1);
    const notes = await db
      .select()
      .from(codiNotifications)
      .where(eq(codiNotifications.chargeId, first.charge.id));
    expect(notes).toHaveLength(0);
  });
});

describe("createCharge — enlace", () => {
  it("guarda el enlace con el importe capturado y sin teléfono", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const result = await createCharge({ db, pey }, merchant.id, {
      amountCents: 15050,
      idempotencyKey: newKey(),
      method: "link",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.charge).toMatchObject({
      status: "waiting_payment",
      collectionMethod: "link",
      phoneLast4: null,
      qr: null,
    });
    expect(result.charge.paymentLink?.url).toMatch(
      /^https:\/\/app\.mipey\.mx\/payment-link\//,
    );
    expect(JSON.stringify(result.charge)).not.toContain("peyPaymentLinkId");
    expect(pey.linkCalls).toHaveLength(1);
    expect(pey.linkCalls[0].amountCents).toBe(15050);
    expect(pey.linkCalls[0].successUrl).toContain("/enlace/pago-completado");
    expect(pey.linkCalls[0].backUrl).toContain("/enlace/pago-cancelado");
    expect(pey.calls).toHaveLength(0);
    expect(pey.pushCalls).toHaveLength(0);

    const [row] = await db
      .select()
      .from(charges)
      .where(eq(charges.id, result.charge.id));
    expect(row.phoneHash).toBeNull();
    const links = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.chargeId, result.charge.id));
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe(result.charge.paymentLink?.url);
  });

  it("repetir la misma intención no crea otro enlace; otra forma sí choca", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const idempotencyKey = newKey();
    const input = {
      amountCents: 15050,
      idempotencyKey,
      method: "link" as const,
    };
    const first = await createCharge({ db, pey }, merchant.id, input);
    const second = await createCharge({ db, pey }, merchant.id, input);
    const conflict = await createCharge({ db, pey }, merchant.id, {
      amountCents: 15050,
      idempotencyKey,
      method: "qr",
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.replayed).toBe(true);
    expect(second.charge.id).toBe(first.charge.id);
    expect(pey.linkCalls).toHaveLength(1);
    expect(conflict).toEqual({ ok: false, error: "idempotency_conflict" });
  });

  it("un rechazo de Pey no crea el enlace y no se reintenta", async () => {
    const merchant = await newMerchant();
    let calls = 0;
    const adapter: PeyAdapter = {
      kind: "mock",
      async createCounterQr() {
        return {
          status: "uncertain",
          reason: "Esta prueba no crea el QR de mostrador.",
        };
      },
      async createCodiQr() {
        throw new Error("esta prueba no crea QR");
      },
      async queryCodiQrPayments() {
        return { status: "unavailable", reason: "no" };
      },
      async createCodiPush() {
        return { status: "uncertain", reason: "no" };
      },
      async queryCodiPushPayment() {
        return { status: "unavailable", reason: "no" };
      },
      async createPaymentLink() {
        calls += 1;
        return { status: "rejected", errorType: "INVALID_AMOUNT" };
      },
      async queryPaymentLink() {
        return { status: "unavailable", reason: "no" };
      },
    };
    const input = {
      amountCents: 15050,
      idempotencyKey: newKey(),
      method: "link" as const,
    };
    const first = await createCharge({ db, pey: adapter }, merchant.id, input);
    const retry = await createCharge({ db, pey: adapter }, merchant.id, input);

    expect(first.ok && retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(first.charge.status).toBe("qr_uncertain");
    expect(first.charge.creationResult).toBe("rejected");
    expect(first.charge.paymentLink).toBeNull();
    expect(retry.replayed).toBe(true);
    expect(calls).toBe(1);
    const links = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.chargeId, first.charge.id));
    expect(links).toHaveLength(0);
    const incidents = await db
      .select()
      .from(paymentIncidents)
      .where(eq(paymentIncidents.chargeId, first.charge.id));
    expect(incidents).toHaveLength(1);
    expect(incidents[0].reason).toBe("INVALID_AMOUNT");
  });

  it("un timeout no reintenta el enlace", async () => {
    const merchant = await newMerchant();
    const pey = createMockPeyAdapter();
    const input = {
      amountCents: 1301,
      idempotencyKey: newKey(),
      method: "link" as const,
    };
    const first = await createCharge({ db, pey }, merchant.id, input);
    const retry = await createCharge({ db, pey }, merchant.id, input);

    expect(first.ok && retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(first.charge.status).toBe("qr_uncertain");
    expect(first.charge.creationResult).toBe("uncertain");
    expect(retry.replayed).toBe(true);
    expect(pey.linkCalls).toHaveLength(1);
    const links = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.chargeId, first.charge.id));
    expect(links).toHaveLength(0);
  });
});
