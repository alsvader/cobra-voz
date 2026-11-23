import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/adapters/db/create-db";
import {
  charges,
  codiNotifications,
  codiQrs,
  merchants,
  paymentLinks,
  payments,
} from "@/adapters/db/schema";
import { chargeReference } from "@/modules/charges/reference";
import { chargeIdSchema } from "@/modules/charges/schemas";
import { loadSettledCharge } from "@/modules/charges/service";
import { businessDayRange, resolveTimeZone } from "./business-day";
import { formatOccurred, movementExplanation } from "./presentation";
import type { DailySummary, MovementDetail, MovementPage } from "./types";

const PAGE_LIMIT = 20;
const RECENT_LIMIT = 5;

type SalesDeps = { db: Database; now?: () => Date };

export type ListMovementsResult =
  ({ ok: true } & MovementPage) | { ok: false; error: "invalid_cursor" };

function asInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`, "utf8").toString(
    "base64url",
  );
}

function decodeCursor(raw: string): { occurredAt: Date; id: string } | null {
  try {
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const separator = text.lastIndexOf("|");
    if (separator <= 0) return null;
    const occurredAt = new Date(text.slice(0, separator));
    const id = text.slice(separator + 1);
    if (Number.isNaN(occurredAt.getTime())) return null;
    if (!chargeIdSchema.safeParse(id).success) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

async function timeZoneOf(db: Database, merchantId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: merchants.timezone })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);
  return resolveTimeZone(row?.timezone);
}

/** Pasa a `expired` los cobros en espera cuyo QR ya venció, antes de listarlos. */
async function expireDue(db: Database, merchantId: string, now: Date) {
  await db
    .update(charges)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(charges.merchantId, merchantId),
        eq(charges.status, "waiting_payment"),
        lte(charges.expiresAt, now),
      ),
    );
}

/**
 * Total y número de pagos conciliados cuyo `paid_at` cae en el día comercial
 * del comercio. Cuenta el QR, la notificación, el enlace y el QR de
 * mostrador. Suma el dinero recibido, no el importe capturado. Un incidente,
 * un pendiente o un vencido no entra.
 */
export async function getDailySummary(
  deps: SalesDeps,
  merchantId: string,
): Promise<DailySummary> {
  const now = (deps.now ?? (() => new Date()))();
  const zone = await timeZoneOf(deps.db, merchantId);
  const day = businessDayRange(zone, now);

  const [row] = await deps.db
    .select({
      totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      count: sql<number>`count(${payments.id})::int`,
    })
    .from(payments)
    .leftJoin(codiQrs, eq(codiQrs.id, payments.codiQrId))
    .leftJoin(
      codiNotifications,
      eq(codiNotifications.id, payments.codiNotificationId),
    )
    .leftJoin(paymentLinks, eq(paymentLinks.id, payments.paymentLinkId))
    .innerJoin(
      charges,
      sql`${charges.id} = coalesce(${codiQrs.chargeId}, ${codiNotifications.chargeId}, ${paymentLinks.chargeId}, ${payments.chargeId})`,
    )
    .where(
      and(
        eq(charges.merchantId, merchantId),
        eq(payments.reconciliationStatus, "reconciled"),
        gte(payments.paidAt, day.start),
        lt(payments.paidAt, day.end),
      ),
    );

  return {
    totalCents: asInt(row?.totalCents),
    count: asInt(row?.count),
  };
}

/**
 * Historial newest-first. Incluye pendientes e incidencias, pero el orden de
 * un pago conciliado usa `paid_at` (un pago tardío no se queda en el día del
 * QR). `limit` por defecto es la página de P04; Inicio pide menos.
 */
export async function listMovements(
  deps: SalesDeps,
  merchantId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<ListMovementsResult> {
  const now = (deps.now ?? (() => new Date()))();
  const zone = await timeZoneOf(deps.db, merchantId);
  await expireDue(deps.db, merchantId, now);

  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  if (options.cursor && !cursor) return { ok: false, error: "invalid_cursor" };

  const limit = Math.min(Math.max(options.limit ?? PAGE_LIMIT, 1), PAGE_LIMIT);
  const reconciled = alias(payments, "reconciled_payment");
  const sortAt = () =>
    sql`coalesce(${reconciled.paidAt}, ${charges.createdAt})`;

  const rows = await deps.db
    .select({
      id: charges.id,
      status: charges.status,
      amountCents: charges.amountCents,
      collectionMethod: charges.collectionMethod,
      createdAt: charges.createdAt,
      paidAt: reconciled.paidAt,
    })
    .from(charges)
    .leftJoin(
      reconciled,
      and(
        eq(reconciled.id, charges.paidPaymentId),
        eq(reconciled.reconciliationStatus, "reconciled"),
      ),
    )
    .where(
      and(
        eq(charges.merchantId, merchantId),
        cursor
          ? sql`(
              ${sortAt()} < ${cursor.occurredAt.toISOString()}::timestamptz
              or (
                ${sortAt()} = ${cursor.occurredAt.toISOString()}::timestamptz
                and ${charges.id} < ${cursor.id}::uuid
              )
            )`
          : undefined,
      ),
    )
    .orderBy(sql`${sortAt()} desc`, sql`${charges.id} desc`)
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const movements = page.map((row) => {
    const occurredAt = row.paidAt ?? row.createdAt;
    return {
      id: row.id,
      reference: chargeReference(row.id),
      status: row.status,
      amountCents: row.amountCents,
      methodLabel:
        row.collectionMethod === "counter" ? "QR de mostrador" : null,
      occurredAt: occurredAt.toISOString(),
      occurredLabel: formatOccurred(occurredAt, zone),
    };
  });
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor(last.paidAt ?? last.createdAt, last.id)
      : null;

  return { ok: true, movements, nextCursor };
}

/** Los cinco movimientos más recientes de Inicio. */
export async function listRecentMovements(
  deps: SalesDeps,
  merchantId: string,
): Promise<MovementPage> {
  const page = await listMovements(deps, merchantId, { limit: RECENT_LIMIT });
  if (!page.ok) return { movements: [], nextCursor: null };
  return { movements: page.movements, nextCursor: page.nextCursor };
}

/** A03. Un cobro de otro comercio es indistinguible de uno que no existe. */
export async function getMovementDetail(
  deps: SalesDeps,
  merchantId: string,
  chargeId: string,
): Promise<MovementDetail | null> {
  const settled = await loadSettledCharge(deps, merchantId, chargeId);
  if (!settled) return null;

  const zone = await timeZoneOf(deps.db, merchantId);
  const [payment] = await deps.db
    .select({
      amountCents: payments.amountCents,
      paidAt: payments.paidAt,
      recordedAt: payments.recordedAt,
      reconciliationStatus: payments.reconciliationStatus,
      collectionMethod: charges.collectionMethod,
    })
    .from(charges)
    .leftJoin(payments, eq(payments.id, charges.paidPaymentId))
    .where(and(eq(charges.id, chargeId), eq(charges.merchantId, merchantId)))
    .limit(1);

  const reconciled = payment?.reconciliationStatus === "reconciled";
  return {
    id: settled.charge.id,
    reference: settled.charge.reference,
    status: settled.charge.status,
    requestedCents: settled.charge.amountCents,
    receivedCents: reconciled ? (payment?.amountCents ?? null) : null,
    createdLabel: formatOccurred(new Date(settled.charge.createdAt), zone),
    paidLabel:
      reconciled && payment?.paidAt
        ? formatOccurred(payment.paidAt, zone)
        : null,
    recordedLabel:
      reconciled && payment?.recordedAt
        ? formatOccurred(payment.recordedAt, zone)
        : null,
    methodLabel:
      payment?.collectionMethod === "counter" ? "QR de mostrador" : "CoDi",
    explanation: movementExplanation(settled.charge.status),
  };
}
