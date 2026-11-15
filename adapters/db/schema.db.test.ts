// @vitest-environment node
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  charges,
  merchantUsers,
  paymentEvents,
  paymentIncidents,
} from "./schema";
import {
  createTestDb,
  insertCharge,
  insertMerchant,
  insertPayment,
  insertQr,
  pgErrorFrom,
  withRollback,
} from "./testing";

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FK_VIOLATION = "23503";

const handle = createTestDb();
const { db } = handle;

beforeAll(async () => {
  // Falla pronto y con mensaje claro si las migraciones no están aplicadas.
  await db.execute(sql`select 1 from charges limit 0`);
});

afterAll(async () => {
  await handle.close();
});

describe("charges", () => {
  it("rechaza importes en cero o negativos (centavos enteros > 0)", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      for (const amountCents of [0, -1]) {
        const error = await pgErrorFrom(tx, (sp) =>
          insertCharge(sp, merchant.id, { amountCents }),
        );
        expect(error).toMatchObject({
          code: CHECK_VIOLATION,
          constraint_name: "charges_amount_cents_positive",
        });
      }
    }));

  it("solo admite MXN", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const error = await pgErrorFrom(tx, (sp) =>
        insertCharge(sp, merchant.id, { currency: "USD" }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "charges_currency_mxn",
      });
    }));

  it("la misma clave de idempotencia no duplica la intención (por comercio)", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const other = await insertMerchant(tx);
      await insertCharge(tx, merchant.id, { idempotencyKey: "intent-1" });

      const error = await pgErrorFrom(tx, (sp) =>
        insertCharge(sp, merchant.id, { idempotencyKey: "intent-1" }),
      );
      expect(error).toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint_name: "charges_merchant_idempotency_key",
      });

      // Otro comercio sí puede usar la misma clave.
      await expect(
        insertCharge(tx, other.id, { idempotencyKey: "intent-1" }),
      ).resolves.toBeDefined();
    }));

  it("arranca en `created` y no permite estados fuera del dominio", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      expect(charge.status).toBe("created");

      const error = await pgErrorFrom(tx, (sp) =>
        sp.execute(
          sql`update charges set status = 'refunded' where id = ${charge.id}`,
        ),
      );
      expect(error.code).toBe("22P02"); // invalid_text_representation (enum)
    }));

  it("no admite `paid` sin un pago verificado asociado", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const error = await pgErrorFrom(tx, (sp) =>
        insertCharge(sp, merchant.id, { status: "paid" }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "charges_paid_requires_payment",
      });
    }));

  it("permite `paid` cuando existe el pago", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      const qr = await insertQr(tx, charge.id);
      const payment = await insertPayment(tx, qr.id);

      const [updated] = await tx
        .update(charges)
        .set({ status: "paid", paidPaymentId: payment.id })
        .where(sql`${charges.id} = ${charge.id}`)
        .returning();
      expect(updated.status).toBe("paid");
    }));

  it("`locally_closed` exige fecha de cierre", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const error = await pgErrorFrom(tx, (sp) =>
        insertCharge(sp, merchant.id, { status: "locally_closed" }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "charges_locally_closed_requires_closed_at",
      });
    }));

  it("no permite borrar un comercio con cobros (trazabilidad)", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      await insertCharge(tx, merchant.id);
      const error = await pgErrorFrom(tx, (sp) =>
        sp.execute(sql`delete from merchants where id = ${merchant.id}`),
      );
      expect(error.code).toBe(FK_VIOLATION);
    }));
});

describe("codi_qrs", () => {
  it("un cobro tiene como máximo un QR", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      await insertQr(tx, charge.id);

      const error = await pgErrorFrom(tx, (sp) => insertQr(sp, charge.id));
      expect(error).toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint_name: "codi_qrs_charge_id_key",
      });
    }));

  it("`pey_qr_id` es único", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const a = await insertCharge(tx, merchant.id);
      const b = await insertCharge(tx, merchant.id);
      await insertQr(tx, a.id, { peyQrId: "qr-duplicado" });

      const error = await pgErrorFrom(tx, (sp) =>
        insertQr(sp, b.id, { peyQrId: "qr-duplicado" }),
      );
      expect(error).toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint_name: "codi_qrs_pey_qr_id_key",
      });
    }));

  it("`num_ref` admite máximo 7 dígitos y puede reutilizarse", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const a = await insertCharge(tx, merchant.id);
      const b = await insertCharge(tx, merchant.id);
      const c = await insertCharge(tx, merchant.id);

      const error = await pgErrorFrom(tx, (sp) =>
        insertQr(sp, a.id, { numRef: 10_000_000 }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "codi_qrs_num_ref_max_7_digits",
      });

      await insertQr(tx, b.id, { numRef: 9_999_999 });
      await expect(
        insertQr(tx, c.id, { numRef: 9_999_999 }),
      ).resolves.toBeDefined();
    }));
});

describe("payments", () => {
  it("la misma transacción bancaria se registra una sola vez", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      const qr = await insertQr(tx, charge.id);
      await insertPayment(tx, qr.id, { providerTransactionId: "tx-1" });

      const error = await pgErrorFrom(tx, (sp) =>
        insertPayment(sp, qr.id, { providerTransactionId: "tx-1" }),
      );
      expect(error).toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint_name: "payments_provider_transaction_key",
      });
    }));

  it("un QR puede registrar varios movimientos distintos", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      const qr = await insertQr(tx, charge.id);
      await insertPayment(tx, qr.id, { providerTransactionId: "tx-a" });
      await expect(
        insertPayment(tx, qr.id, { providerTransactionId: "tx-b" }),
      ).resolves.toBeDefined();
    }));

  it("rechaza importes recibidos no positivos", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      const qr = await insertQr(tx, charge.id);
      const error = await pgErrorFrom(tx, (sp) =>
        insertPayment(sp, qr.id, { amountCents: 0 }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "payments_amount_cents_positive",
      });
    }));

  it("un pago conciliado exige fecha de conciliación", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      const qr = await insertQr(tx, charge.id);
      const error = await pgErrorFrom(tx, (sp) =>
        insertPayment(sp, qr.id, { reconciledAt: null }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "payments_reconciled_requires_reconciled_at",
      });
    }));

  it("separa `paid_at` (fecha efectiva) de `recorded_at`", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      const qr = await insertQr(tx, charge.id);
      const paidAt = new Date("2026-11-14T03:30:00.000Z");
      const payment = await insertPayment(tx, qr.id, { paidAt });

      expect(payment.paidAt.toISOString()).toBe(paidAt.toISOString());
      expect(payment.recordedAt.getTime()).toBeGreaterThan(paidAt.getTime());
    }));
});

describe("payment_events", () => {
  it("una misma entrega de webhook se registra una sola vez", () =>
    withRollback(db, async (tx) => {
      const values = {
        webhookId: "msg_1",
        eventType: "codi.qr.payment_received",
        validationStatus: "verified" as const,
      };
      await tx.insert(paymentEvents).values(values);

      const error = await pgErrorFrom(tx, (sp) =>
        sp.insert(paymentEvents).values(values),
      );
      expect(error).toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint_name: "payment_events_provider_webhook_key",
      });
    }));

  it("dos entregas distintas pueden referir la misma transacción (el pago es el que deduplica)", () =>
    withRollback(db, async (tx) => {
      const base = {
        eventType: "codi.qr.payment_received",
        validationStatus: "verified" as const,
        providerTransactionId: "tx-1",
      };
      await tx.insert(paymentEvents).values({ ...base, webhookId: "msg_1" });
      await expect(
        tx.insert(paymentEvents).values({ ...base, webhookId: "msg_2" }),
      ).resolves.toBeDefined();
    }));
});

describe("payment_incidents", () => {
  it("debe apuntar al menos a un cobro, pago o evento", () =>
    withRollback(db, async (tx) => {
      const error = await pgErrorFrom(tx, (sp) =>
        sp
          .insert(paymentIncidents)
          .values({ type: "other", reason: "sin referencia" }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "payment_incidents_has_reference",
      });
    }));

  it("una incidencia resuelta exige fecha de resolución", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const charge = await insertCharge(tx, merchant.id);
      const error = await pgErrorFrom(tx, (sp) =>
        sp.insert(paymentIncidents).values({
          chargeId: charge.id,
          type: "amount_mismatch",
          reason: "Importe distinto",
          status: "resolved",
        }),
      );
      expect(error).toMatchObject({
        code: CHECK_VIOLATION,
        constraint_name: "payment_incidents_resolved_requires_resolved_at",
      });
    }));
});

describe("merchants y usuarios", () => {
  it("un usuario solo puede vincularse si existe en auth.users", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const error = await pgErrorFrom(tx, (sp) =>
        sp
          .insert(merchantUsers)
          .values({ userId: randomUUID(), merchantId: merchant.id }),
      );
      expect(error.code).toBe(FK_VIOLATION);
    }));

  it("el comercio usa America/Mexico_City por defecto y audio activado", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      expect(merchant.timezone).toBe("America/Mexico_City");

      const [prefs] = await tx.execute<{
        voice_announcements_enabled: boolean;
      }>(
        sql`insert into merchant_preferences (merchant_id) values (${merchant.id}) returning voice_announcements_enabled`,
      );
      expect(prefs.voice_announcements_enabled).toBe(true);
    }));
});

describe("seguridad de acceso por la API de Supabase", () => {
  const TABLES = [
    "merchants",
    "merchant_users",
    "merchant_preferences",
    "charges",
    "codi_qrs",
    "payments",
    "payment_events",
    "payment_incidents",
  ];

  it("todas las tablas tienen RLS activo", async () => {
    const rows = await db.execute<{ relname: string; relrowsecurity: boolean }>(
      sql`select relname, relrowsecurity from pg_class
          where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    const rls = new Map(rows.map((r) => [r.relname, r.relrowsecurity]));
    for (const table of TABLES) {
      expect(rls.get(table), table).toBe(true);
    }
  });

  it("control positivo: el rol del backend sí tiene privilegios", async () => {
    const [row] = await db.execute<{ allowed: boolean }>(
      sql`select has_table_privilege('postgres', 'public.charges', 'SELECT') as allowed`,
    );
    expect(row.allowed).toBe(true);
  });

  it("la API REST de Supabase con la clave publicable no lee ni escribe cobros", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Faltan NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY (npm run db:env).",
      );
    }
    const headers = { apikey: key, "Content-Type": "application/json" };

    for (const table of ["charges", "payments", "merchants"]) {
      const read = await fetch(`${url}/rest/v1/${table}?select=*`, { headers });
      expect(read.ok, `GET ${table}`).toBe(false);
      expect(await read.text()).toContain("permission denied");
    }

    const write = await fetch(`${url}/rest/v1/charges`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount_cents: 1 }),
    });
    expect(write.ok).toBe(false);
  });

  it("anon y authenticated no tienen privilegios sobre las tablas", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of TABLES) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          const [row] = await db.execute<{ allowed: boolean }>(
            sql`select has_table_privilege(${role}, ${`public.${table}`}, ${privilege}) as allowed`,
          );
          expect(row.allowed, `${role} ${privilege} ${table}`).toBe(false);
        }
      }
    }
  });
});
