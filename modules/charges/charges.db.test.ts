import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  charges,
  codiQrs,
  merchants,
  paymentIncidents,
} from "@/adapters/db/schema";
import { createTestDb } from "@/adapters/db/testing";
import {
  MOCK_QR_PREFIX,
  MOCK_UNCERTAIN_AMOUNT_CENTS,
  createMockPeyAdapter,
} from "@/adapters/pey/mock";
import type { CreateQrOutcome, PeyAdapter } from "@/adapters/pey/types";
import { STALE_CREATED_MS, createCharge, getCharge } from "./service";

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
    async createCodiQr(request) {
      calls.push(request);
      return produce();
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
    await db.delete(codiQrs).where(inArray(codiQrs.chargeId, chargeIds));
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
