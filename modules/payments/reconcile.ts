import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { Database } from "@/adapters/db/create-db";
import {
  charges,
  codiNotifications,
  codiQrs,
  merchants,
} from "@/adapters/db/schema";
import type { PeyAdapter, QueriedPayment } from "@/adapters/pey/types";
import { MAX_AMOUNT_CENTS } from "@/modules/charges/amount";
import {
  loadSettledCharge,
  type SettledCharge,
} from "@/modules/charges/service";
import type { ChargeDto } from "@/modules/charges/types";
import { recordPeyPayment } from "./service";

/**
 * Mínimo entre consultas al proveedor para el MISMO cobro en el cron.
 * La pasada programada es cada 5 min; este margen evita dos pasadas
 * solapadas. «Consultar nuevamente» no lo usa: el comerciante lo pidió.
 */
export const RECONCILIATION_MIN_INTERVAL_MS = 4 * 60 * 1000;

/**
 * «Expirados recientes» y cierres locales relevantes (Architecture §9).
 * Pasada esa ventana el cron deja de preguntar; un pago más tardío sigue
 * pudiendo entrar por webhook.
 */
export const RECONCILIATION_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Tope por pasada para no disparar una consulta por cada cobro histórico. */
export const RECONCILIATION_BATCH_LIMIT = 20;

const RECONCILABLE = [
  "waiting_payment",
  "expired",
  "locally_closed",
  "incident",
] as const;

type ReconcileDeps = {
  db: Database;
  pey: PeyAdapter;
  now?: () => Date;
};

export type ReconcileChargeResult =
  | {
      ok: true;
      charge: ChargeDto;
      outcome: "paid" | "incident" | "unchanged";
      /** `false` cuando no había nada que preguntar o el cron ya había pasado. */
      queried: boolean;
    }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "not_reconcilable"; charge: ChargeDto }
  | { ok: false; error: "unavailable"; charge: ChargeDto };

function queryEventId(transactionId: string): string {
  return `query:${transactionId}`;
}

/** Descarta filas que no son evidencia bancaria. No se convierten en pago. */
function usablePayment(payment: QueriedPayment): boolean {
  return (
    typeof payment.transactionId === "string" &&
    payment.transactionId.trim().length > 0 &&
    payment.transactionId.length <= 128 &&
    Number.isInteger(payment.amountCents) &&
    payment.amountCents > 0 &&
    payment.amountCents <= MAX_AMOUNT_CENTS &&
    (payment.numRef === null ||
      (Number.isInteger(payment.numRef) &&
        payment.numRef >= 0 &&
        payment.numRef <= 9_999_999)) &&
    (payment.bankAccountId === null ||
      (payment.bankAccountId.trim().length > 0 &&
        payment.bankAccountId.trim().length <= 128)) &&
    payment.paidAt instanceof Date &&
    !Number.isNaN(payment.paidAt.getTime())
  );
}

async function stampAttempt(db: Database, chargeId: string, now: Date) {
  await db
    .update(charges)
    .set({ lastReconciliationAt: now, updatedAt: now })
    .where(eq(charges.id, chargeId));
}

/**
 * Consulta a Pey un cobro del comercio y aplica la MISMA lógica que el
 * webhook (Architecture §8 y §9).
 *
 * - Sin `pey_qr_id` ni `transactionId` no se llama al proveedor.
 * - Un cobro ya `paid` no se vuelve a consultar.
 * - Si Pey no responde, el cobro no cambia a pagado.
 * - La misma transacción, llegue por webhook o por esta consulta, queda
 *   registrada una sola vez.
 */
export async function reconcileCharge(
  deps: ReconcileDeps,
  merchantId: string,
  chargeId: string,
  options: { respectInterval?: boolean } = {},
): Promise<ReconcileChargeResult> {
  const now = (deps.now ?? (() => new Date()))();
  const settled = await loadSettledCharge(deps, merchantId, chargeId);
  if (!settled) return { ok: false, error: "not_found" };

  const reconcilable = (RECONCILABLE as readonly string[]).includes(
    settled.charge.status,
  );
  if (settled.charge.status === "paid" || !reconcilable) {
    return {
      ok: true,
      charge: settled.charge,
      outcome: settled.charge.status === "paid" ? "paid" : "unchanged",
      queried: false,
    };
  }

  if (!settled.peyQrId && !settled.peyTransactionId) {
    return { ok: false, error: "not_reconcilable", charge: settled.charge };
  }

  if (options.respectInterval) {
    const claimed = await claimAttempt(deps.db, chargeId, now);
    if (!claimed) {
      return {
        ok: true,
        charge: settled.charge,
        outcome: "unchanged",
        queried: false,
      };
    }
  }

  if (settled.peyTransactionId && !settled.peyQrId) {
    return reconcilePush(deps, merchantId, chargeId, settled, now, options);
  }

  const queried = await deps.pey.queryCodiQrPayments(settled.peyQrId!);
  if (!options.respectInterval) {
    await stampAttempt(deps.db, chargeId, now);
  }

  if (queried.status === "unavailable") {
    console.warn(
      JSON.stringify({
        event: "reconciliation_unavailable",
        chargeId,
        reason: queried.reason,
      }),
    );
    return { ok: false, error: "unavailable", charge: settled.charge };
  }

  return applyPayments(deps, merchantId, chargeId, settled, queried.payments);
}

async function reconcilePush(
  deps: ReconcileDeps,
  merchantId: string,
  chargeId: string,
  settled: SettledCharge,
  now: Date,
  options: { respectInterval?: boolean },
): Promise<ReconcileChargeResult> {
  const transactionId = settled.peyTransactionId;
  if (!transactionId) {
    return { ok: false, error: "not_reconcilable", charge: settled.charge };
  }

  const queried = await deps.pey.queryCodiPushPayment(transactionId);
  if (!options.respectInterval) {
    await stampAttempt(deps.db, chargeId, now);
  }
  if (queried.status === "unavailable") {
    console.warn(
      JSON.stringify({
        event: "reconciliation_unavailable",
        chargeId,
        reason: queried.reason,
      }),
    );
    return { ok: false, error: "unavailable", charge: settled.charge };
  }
  if (!queried.payment) {
    const reloaded = await loadSettledCharge(deps, merchantId, chargeId);
    return {
      ok: true,
      charge: reloaded?.charge ?? settled.charge,
      outcome: "unchanged",
      queried: true,
    };
  }

  const [known] = await deps.db
    .select({
      numRef: codiNotifications.numRef,
      bankAccountId: merchants.peyBankAccountId,
    })
    .from(codiNotifications)
    .innerJoin(charges, eq(charges.id, codiNotifications.chargeId))
    .innerJoin(merchants, eq(merchants.id, charges.merchantId))
    .where(eq(codiNotifications.peyTransactionId, transactionId))
    .limit(1);
  if (!known) {
    return { ok: false, error: "not_reconcilable", charge: settled.charge };
  }

  const payment = queried.payment;
  await recordPeyPayment(
    deps,
    queryEventId(payment.transactionId.trim()),
    {
      kind: "pn",
      transactionId: payment.transactionId.trim(),
      amountCents: payment.amountCents,
      numRef: payment.numRef ?? known.numRef,
      bankAccountId: payment.bankAccountId?.trim() || known.bankAccountId,
      paidAt: payment.paidAt,
      chargeId: queried.chargeId,
    },
    { evidenceSource: "provider_query" },
  );

  const reloaded = await loadSettledCharge(deps, merchantId, chargeId);
  const charge = reloaded?.charge ?? settled.charge;
  const outcome =
    charge.status === "paid"
      ? "paid"
      : charge.status === "incident"
        ? "incident"
        : "unchanged";
  return { ok: true, charge, outcome, queried: true };
}

async function claimAttempt(
  db: Database,
  chargeId: string,
  now: Date,
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - RECONCILIATION_MIN_INTERVAL_MS);
  const claimed = await db
    .update(charges)
    .set({ lastReconciliationAt: now, updatedAt: now })
    .where(
      and(
        eq(charges.id, chargeId),
        or(
          isNull(charges.lastReconciliationAt),
          lte(charges.lastReconciliationAt, cutoff),
        ),
      ),
    )
    .returning({ id: charges.id });
  return claimed.length > 0;
}

async function applyPayments(
  deps: ReconcileDeps,
  merchantId: string,
  chargeId: string,
  settled: SettledCharge,
  payments: QueriedPayment[],
): Promise<ReconcileChargeResult> {
  const peyQrId = settled.peyQrId;
  if (!peyQrId) {
    return { ok: false, error: "not_reconcilable", charge: settled.charge };
  }

  const [known] = await deps.db
    .select({
      numRef: codiQrs.numRef,
      bankAccountId: merchants.peyBankAccountId,
    })
    .from(codiQrs)
    .innerJoin(charges, eq(charges.id, codiQrs.chargeId))
    .innerJoin(merchants, eq(merchants.id, charges.merchantId))
    .where(eq(codiQrs.peyQrId, peyQrId))
    .limit(1);
  if (!known) {
    return { ok: false, error: "not_reconcilable", charge: settled.charge };
  }

  for (const payment of payments) {
    if (!usablePayment(payment)) continue;
    await recordPeyPayment(
      deps,
      queryEventId(payment.transactionId.trim()),
      {
        kind: "qr",
        transactionId: payment.transactionId.trim(),
        codiQrId: peyQrId,
        amountCents: payment.amountCents,
        numRef: payment.numRef ?? known.numRef,
        bankAccountId: payment.bankAccountId?.trim() || known.bankAccountId,
        paidAt: payment.paidAt,
        chargeId: null,
      },
      { evidenceSource: "provider_query" },
    );
  }

  const reloaded = await loadSettledCharge(deps, merchantId, chargeId);
  const charge = reloaded?.charge ?? settled.charge;
  const outcome =
    charge.status === "paid"
      ? "paid"
      : charge.status === "incident"
        ? "incident"
        : "unchanged";
  return { ok: true, charge, outcome, queried: true };
}

export type ReconcilePendingResult = {
  examined: number;
  paid: number;
  incidents: number;
  unchanged: number;
  unavailable: number;
  skipped: number;
};

/**
 * Pasada del cron: cobros con QR o notificación conocidos que siguen abiertos
 * a un pago (en espera, vencidos o cerrados en local dentro de 24 h, e
 * incidencias).
 * Cada cobro se consulta como máximo una vez por intervalo.
 * `merchantId` acota la pasada a un comercio; el cron no lo envía.
 */
export async function reconcilePending(
  deps: ReconcileDeps,
  options: { limit?: number; merchantId?: string } = {},
): Promise<ReconcilePendingResult> {
  const now = (deps.now ?? (() => new Date()))();
  const cutoff = new Date(now.getTime() - RECONCILIATION_MIN_INTERVAL_MS);
  const recentAfter = new Date(now.getTime() - RECONCILIATION_RECENT_WINDOW_MS);
  const limit = options.limit ?? RECONCILIATION_BATCH_LIMIT;

  const due = await deps.db
    .select({
      id: charges.id,
      merchantId: charges.merchantId,
    })
    .from(charges)
    .leftJoin(codiQrs, eq(codiQrs.chargeId, charges.id))
    .leftJoin(codiNotifications, eq(codiNotifications.chargeId, charges.id))
    .where(
      and(
        or(isNotNull(codiQrs.id), isNotNull(codiNotifications.id)),
        options.merchantId
          ? eq(charges.merchantId, options.merchantId)
          : undefined,
        inArray(charges.status, [...RECONCILABLE]),
        or(
          isNull(charges.lastReconciliationAt),
          lte(charges.lastReconciliationAt, cutoff),
        ),
        or(
          eq(charges.status, "waiting_payment"),
          eq(charges.status, "incident"),
          and(
            eq(charges.status, "expired"),
            gt(charges.expiresAt, recentAfter),
          ),
          and(
            eq(charges.status, "locally_closed"),
            gt(charges.closedAt, recentAfter),
          ),
        ),
      ),
    )
    .orderBy(sql`${charges.lastReconciliationAt} asc nulls first`)
    .limit(limit);

  const result: ReconcilePendingResult = {
    examined: 0,
    paid: 0,
    incidents: 0,
    unchanged: 0,
    unavailable: 0,
    skipped: 0,
  };

  for (const row of due) {
    const outcome = await reconcileCharge(deps, row.merchantId, row.id, {
      respectInterval: true,
    });
    if (!outcome.ok) {
      if (outcome.error === "unavailable") result.unavailable += 1;
      else result.skipped += 1;
      continue;
    }
    if (!outcome.queried) {
      result.skipped += 1;
      continue;
    }
    result.examined += 1;
    if (outcome.outcome === "paid") result.paid += 1;
    else if (outcome.outcome === "incident") result.incidents += 1;
    else result.unchanged += 1;
  }

  return result;
}
