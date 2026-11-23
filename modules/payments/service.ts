import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/adapters/db/create-db";
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
import { REAL_QR_AMOUNT_CENTS } from "@/adapters/pey/contract";
import { isValidAmountCents } from "@/modules/charges/amount";
import type { PeyPaymentNotice } from "./schema";

const PROVIDER = "pey";

/** Estados desde los que un pago que coincide puede dejar el cobro en `paid`. */
const PAYABLE_STATUSES = [
  "waiting_payment",
  "expired",
  "locally_closed",
  "incident",
] as const;

const MISMATCH_LABEL = {
  amount_mismatch: "El importe recibido no coincide con el cobro.",
  reference_mismatch: "La referencia numérica no coincide con el cobro.",
  account_mismatch: "La cuenta receptora no coincide con la del comercio.",
} as const;

type Mismatch = keyof typeof MISMATCH_LABEL;

export type RecordPaymentResult = {
  outcome: "paid" | "incident" | "ignored";
  /** Esta entrega ya se había procesado, o la transacción bancaria ya existía. */
  duplicate: boolean;
};

type Deps = { db: Database; now?: () => Date };

type RecordOptions = {
  /** De dónde salió la evidencia. Por defecto, el webhook firmado. */
  evidenceSource?: "webhook" | "provider_query";
};

/**
 * Registra un aviso de pago YA firmado (Architecture §8).
 *
 * Todo el efecto ocurre en una transacción. Si algo falla antes del commit,
 * no queda pago ni cobro «pagado» y el llamador responde error para que Pey
 * reintente.
 *
 * - El mismo `webhook-id` no aplica el negocio dos veces.
 * - El mismo `transactionId` no crea dos pagos, aunque llegue en otra entrega.
 * - Solo un aviso que coincide en QR, importe, referencia y cuenta deja el
 *   cobro en `paid`. Un pago de exactamente un centavo también: es el importe
 *   del QR, de la notificación y del enlace reales, aunque el cobro guarde el
 *   importe capturado en la app.
 *   Un pago tardío (cobro vencido o cerrado en local) también cuenta,
 *   porque vencido no es rechazado.
 * - Una discrepancia guarda el pago como incidencia y no lo cuenta como venta.
 * - Un QR desconocido no inventa un cobro: solo queda el evento y la incidencia.
 */
export async function recordPeyPayment(
  deps: Deps,
  webhookId: string,
  notice: PeyPaymentNotice,
  options: RecordOptions = {},
): Promise<RecordPaymentResult> {
  const now = (deps.now ?? (() => new Date()))();
  const evidenceSource = options.evidenceSource ?? "webhook";
  const eventType =
    notice.kind === "link"
      ? evidenceSource === "provider_query"
        ? "payment_link.status_query"
        : "payment_link.status_updated"
      : notice.kind === "pn"
        ? evidenceSource === "provider_query"
          ? "codi.pn.payment_query"
          : "codi.pn.payment_received"
        : evidenceSource === "provider_query"
          ? "codi.qr.payment_query"
          : "codi.qr.payment_received";

  return deps.db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(paymentEvents)
      .values({
        provider: PROVIDER,
        webhookId,
        eventType,
        validationStatus: "verified",
        processingStatus: "pending",
        providerTransactionId:
          notice.kind === "link"
            ? (notice.transactionId ?? notice.paymentLinkId)
            : notice.transactionId,
        providerQrId: notice.kind === "qr" ? notice.codiQrId : null,
        receivedAt: now,
      })
      .onConflictDoNothing({
        target: [paymentEvents.provider, paymentEvents.webhookId],
      })
      .returning({ id: paymentEvents.id });

    const eventId = inserted?.id ?? (await existingEventId(tx, webhookId));
    if (!inserted) {
      const [prior] = await tx
        .select({ status: paymentEvents.processingStatus })
        .from(paymentEvents)
        .where(eq(paymentEvents.id, eventId));
      if (prior && prior.status !== "pending") {
        return {
          outcome:
            prior.status === "applied"
              ? "paid"
              : prior.status === "ignored"
                ? "ignored"
                : "incident",
          duplicate: true,
        };
      }
    }

    if (notice.kind === "link" && !notice.settles) {
      await tx
        .update(paymentEvents)
        .set({
          processingStatus: "ignored",
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(paymentEvents.id, eventId));
      return { outcome: "ignored", duplicate: false };
    }

    const instrument = await findInstrument(tx, notice);
    if (!instrument) {
      if (notice.kind === "qr") {
        const counter = await findReadyCounter(tx, notice.codiQrId);
        if (counter) {
          return settleCounterQr(tx, {
            eventId,
            now,
            notice,
            counter,
            evidenceSource,
          });
        }
      }
      await finishIncident(tx, {
        eventId,
        now,
        type: notice.kind === "qr" ? "unknown_qr" : "other",
        reason:
          notice.kind === "qr"
            ? "Pey avisó un pago de un QR que CobraVoz no tiene registrado."
            : notice.kind === "link"
              ? "Pey avisó un pago de un enlace que CobraVoz no tiene registrado."
              : "Pey avisó un pago de una notificación que CobraVoz no tiene registrada.",
      });
      return { outcome: "incident", duplicate: false };
    }

    const mismatches = mismatchesOf(notice, instrument);
    const chargeMismatch =
      notice.chargeId != null && notice.chargeId !== instrument.chargeId;
    const reconciled = mismatches.length === 0 && !chargeMismatch;

    const providerTransactionId =
      notice.kind === "link"
        ? (notice.transactionId ?? notice.paymentLinkId)
        : notice.transactionId;

    const [payment] = await tx
      .insert(payments)
      .values({
        codiQrId: instrument.kind === "qr" ? instrument.id : null,
        codiNotificationId: instrument.kind === "pn" ? instrument.id : null,
        paymentLinkId: instrument.kind === "link" ? instrument.id : null,
        provider: PROVIDER,
        providerTransactionId,
        amountCents: notice.amountCents,
        reconciliationStatus: reconciled ? "reconciled" : "incident",
        evidenceSource,
        paidAt: notice.paidAt,
        recordedAt: now,
        reconciledAt: reconciled ? now : null,
      })
      .onConflictDoNothing({
        target: [payments.provider, payments.providerTransactionId],
      })
      .returning({ id: payments.id });

    if (!payment) {
      const [existing] = await tx
        .select({ status: payments.reconciliationStatus })
        .from(payments)
        .where(
          and(
            eq(payments.provider, PROVIDER),
            eq(payments.providerTransactionId, providerTransactionId),
          ),
        )
        .limit(1);
      await tx
        .update(paymentEvents)
        .set({
          processingStatus: "ignored",
          codiQrId: instrument.kind === "qr" ? instrument.id : null,
          codiNotificationId: instrument.kind === "pn" ? instrument.id : null,
          paymentLinkId: instrument.kind === "link" ? instrument.id : null,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(paymentEvents.id, eventId));
      return {
        outcome: existing?.status === "reconciled" ? "paid" : "incident",
        duplicate: true,
      };
    }

    await tx
      .update(paymentEvents)
      .set({
        processingStatus: reconciled ? "applied" : "incident",
        codiQrId: instrument.kind === "qr" ? instrument.id : null,
        codiNotificationId: instrument.kind === "pn" ? instrument.id : null,
        paymentLinkId: instrument.kind === "link" ? instrument.id : null,
        paymentId: payment.id,
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(paymentEvents.id, eventId));

    if (!reconciled) {
      await tx.insert(paymentIncidents).values({
        chargeId: instrument.chargeId,
        paymentId: payment.id,
        paymentEventId: eventId,
        type: mismatches.length === 1 ? mismatches[0] : "other",
        reason: [
          ...mismatches.map((item) => MISMATCH_LABEL[item]),
          ...(chargeMismatch
            ? ["El identificador del cobro en el aviso no coincide."]
            : []),
        ].join(" "),
      });
      await tx
        .update(charges)
        .set({ status: "incident", updatedAt: now })
        .where(
          and(
            eq(charges.id, instrument.chargeId),
            inArray(charges.status, [
              "waiting_payment",
              "expired",
              "locally_closed",
            ]),
          ),
        );
      return { outcome: "incident", duplicate: false };
    }

    await tx
      .update(charges)
      .set({ status: "paid", paidPaymentId: payment.id, updatedAt: now })
      .where(
        and(
          eq(charges.id, instrument.chargeId),
          inArray(charges.status, [...PAYABLE_STATUSES]),
        ),
      );

    return { outcome: "paid", duplicate: false };
  });
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type CounterRow = {
  id: string;
  merchantId: string;
  numRef: number;
  bankAccountId: string;
};

async function findReadyCounter(
  tx: Tx,
  peyQrId: string,
): Promise<CounterRow | null> {
  const [row] = await tx
    .select({
      id: counterQrs.id,
      merchantId: counterQrs.merchantId,
      numRef: counterQrs.numRef,
      bankAccountId: merchants.peyBankAccountId,
    })
    .from(counterQrs)
    .innerJoin(merchants, eq(merchants.id, counterQrs.merchantId))
    .where(and(eq(counterQrs.peyQrId, peyQrId), eq(counterQrs.status, "ready")))
    .limit(1);
  return row ?? null;
}

/**
 * Cada aviso del QR fijo abre una venta ya pagada por el importe que escribió
 * el cliente. Otro aviso del mismo código es otra venta. Un aviso que no
 * coincide en referencia o cuenta no crea venta.
 */
async function settleCounterQr(
  tx: Tx,
  input: {
    eventId: string;
    now: Date;
    notice: Extract<PeyPaymentNotice, { kind: "qr" }>;
    counter: CounterRow;
    evidenceSource: "webhook" | "provider_query";
  },
): Promise<RecordPaymentResult> {
  const { eventId, now, notice, counter, evidenceSource } = input;
  const mismatches: Mismatch[] = [];
  if (!isValidAmountCents(notice.amountCents))
    mismatches.push("amount_mismatch");
  if (notice.numRef !== counter.numRef) mismatches.push("reference_mismatch");
  if (notice.bankAccountId !== counter.bankAccountId) {
    mismatches.push("account_mismatch");
  }
  if (mismatches.length > 0) {
    await finishIncident(tx, {
      eventId,
      now,
      type: mismatches.length === 1 ? mismatches[0] : "other",
      reason: mismatches.map((item) => MISMATCH_LABEL[item]).join(" "),
    });
    return { outcome: "incident", duplicate: false };
  }

  const [existingPayment] = await tx
    .select({ status: payments.reconciliationStatus })
    .from(payments)
    .where(
      and(
        eq(payments.provider, PROVIDER),
        eq(payments.providerTransactionId, notice.transactionId),
      ),
    )
    .limit(1);
  if (existingPayment) {
    await tx
      .update(paymentEvents)
      .set({
        processingStatus: "ignored",
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(paymentEvents.id, eventId));
    return {
      outcome: existingPayment.status === "reconciled" ? "paid" : "incident",
      duplicate: true,
    };
  }

  const idempotencyKey = `counter:${notice.transactionId}`;
  const [charge] = await tx
    .insert(charges)
    .values({
      merchantId: counter.merchantId,
      amountCents: notice.amountCents,
      status: "created",
      idempotencyKey,
      collectionMethod: "counter",
    })
    .onConflictDoNothing({
      target: [charges.merchantId, charges.idempotencyKey],
    })
    .returning({ id: charges.id });

  if (!charge) {
    const [prior] = await tx
      .select({ status: charges.status })
      .from(charges)
      .where(
        and(
          eq(charges.merchantId, counter.merchantId),
          eq(charges.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    await tx
      .update(paymentEvents)
      .set({
        processingStatus: "ignored",
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(paymentEvents.id, eventId));
    return {
      outcome: prior?.status === "paid" ? "paid" : "incident",
      duplicate: true,
    };
  }

  const [payment] = await tx
    .insert(payments)
    .values({
      counterQrId: counter.id,
      chargeId: charge.id,
      provider: PROVIDER,
      providerTransactionId: notice.transactionId,
      amountCents: notice.amountCents,
      reconciliationStatus: "reconciled",
      evidenceSource,
      paidAt: notice.paidAt,
      recordedAt: now,
      reconciledAt: now,
    })
    .returning({ id: payments.id });

  await tx
    .update(charges)
    .set({ status: "paid", paidPaymentId: payment.id, updatedAt: now })
    .where(eq(charges.id, charge.id));

  await tx
    .update(paymentEvents)
    .set({
      processingStatus: "applied",
      paymentId: payment.id,
      processedAt: now,
      updatedAt: now,
    })
    .where(eq(paymentEvents.id, eventId));

  return { outcome: "paid", duplicate: false };
}

type Instrument = {
  kind: "qr" | "pn" | "link";
  id: string;
  chargeId: string;
  amountCents: number;
  numRef: number;
  bankAccountId: string;
};

async function findInstrument(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  notice: PeyPaymentNotice,
): Promise<Instrument | null> {
  if (notice.kind === "link") {
    const [link] = await tx
      .select({
        id: paymentLinks.id,
        chargeId: charges.id,
        amountCents: charges.amountCents,
      })
      .from(paymentLinks)
      .innerJoin(charges, eq(charges.id, paymentLinks.chargeId))
      .where(eq(paymentLinks.peyPaymentLinkId, notice.paymentLinkId))
      .limit(1);
    return link
      ? { kind: "link", numRef: 0, bankAccountId: "", ...link }
      : null;
  }

  if (notice.kind === "qr") {
    const [qr] = await tx
      .select({
        id: codiQrs.id,
        numRef: codiQrs.numRef,
        chargeId: charges.id,
        amountCents: charges.amountCents,
        bankAccountId: merchants.peyBankAccountId,
      })
      .from(codiQrs)
      .innerJoin(charges, eq(charges.id, codiQrs.chargeId))
      .innerJoin(merchants, eq(merchants.id, charges.merchantId))
      .where(eq(codiQrs.peyQrId, notice.codiQrId))
      .limit(1);
    return qr ? { kind: "qr", ...qr } : null;
  }

  const [notification] = await tx
    .select({
      id: codiNotifications.id,
      numRef: codiNotifications.numRef,
      chargeId: charges.id,
      amountCents: charges.amountCents,
      bankAccountId: merchants.peyBankAccountId,
    })
    .from(codiNotifications)
    .innerJoin(charges, eq(charges.id, codiNotifications.chargeId))
    .innerJoin(merchants, eq(merchants.id, charges.merchantId))
    .where(eq(codiNotifications.peyTransactionId, notice.transactionId))
    .limit(1);
  return notification ? { kind: "pn", ...notification } : null;
}

function mismatchesOf(
  notice: PeyPaymentNotice,
  qr: { amountCents: number; numRef: number; bankAccountId: string },
): Mismatch[] {
  if (notice.kind === "link") {
    const hackathonCent =
      notice.baseCents === REAL_QR_AMOUNT_CENTS ||
      notice.amountCents === REAL_QR_AMOUNT_CENTS;
    return notice.baseCents === qr.amountCents || hackathonCent
      ? []
      : ["amount_mismatch"];
  }
  const found: Mismatch[] = [];
  const hackathonCent = notice.amountCents === REAL_QR_AMOUNT_CENTS;
  if (notice.amountCents !== qr.amountCents && !hackathonCent) {
    found.push("amount_mismatch");
  }
  if (notice.numRef !== qr.numRef) found.push("reference_mismatch");
  if (notice.bankAccountId !== qr.bankAccountId) found.push("account_mismatch");
  return found;
}

async function existingEventId(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  webhookId: string,
): Promise<string> {
  const [row] = await tx
    .select({ id: paymentEvents.id })
    .from(paymentEvents)
    .where(
      and(
        eq(paymentEvents.provider, PROVIDER),
        eq(paymentEvents.webhookId, webhookId),
      ),
    )
    .limit(1);
  if (!row)
    throw new Error("Evento de webhook no encontrado tras el conflicto.");
  return row.id;
}

async function finishIncident(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  input: {
    eventId: string;
    now: Date;
    type:
      | "unknown_qr"
      | "other"
      | "amount_mismatch"
      | "reference_mismatch"
      | "account_mismatch";
    reason: string;
  },
) {
  await tx.insert(paymentIncidents).values({
    paymentEventId: input.eventId,
    type: input.type,
    reason: input.reason,
  });
  await tx
    .update(paymentEvents)
    .set({
      processingStatus: "incident",
      processedAt: input.now,
      updatedAt: input.now,
    })
    .where(eq(paymentEvents.id, input.eventId));
}
