import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/adapters/db/create-db";
import {
  charges,
  codiQrs,
  merchants,
  paymentEvents,
  paymentIncidents,
  payments,
} from "@/adapters/db/schema";
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
  reference_mismatch: "La referencia numérica no coincide con el QR.",
  account_mismatch: "La cuenta receptora no coincide con la del comercio.",
} as const;

type Mismatch = keyof typeof MISMATCH_LABEL;

export type RecordPaymentResult = {
  outcome: "paid" | "incident";
  /** Esta entrega ya se había procesado, o la transacción bancaria ya existía. */
  duplicate: boolean;
};

type Deps = { db: Database; now?: () => Date };

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
 *   cobro en `paid`. Un pago tardío (cobro vencido o cerrado en local) también,
 *   porque vencido no es rechazado.
 * - Una discrepancia guarda el pago como incidencia y no lo cuenta como venta.
 * - Un QR desconocido no inventa un cobro: solo queda el evento y la incidencia.
 */
export async function recordPeyPayment(
  deps: Deps,
  webhookId: string,
  notice: PeyPaymentNotice,
): Promise<RecordPaymentResult> {
  const now = (deps.now ?? (() => new Date()))();

  return deps.db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(paymentEvents)
      .values({
        provider: PROVIDER,
        webhookId,
        eventType: "codi.qr.payment_received",
        validationStatus: "verified",
        processingStatus: "pending",
        providerTransactionId: notice.transactionId,
        providerQrId: notice.codiQrId,
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
          outcome: prior.status === "applied" ? "paid" : "incident",
          duplicate: true,
        };
      }
    }

    const [qr] = await tx
      .select({
        id: codiQrs.id,
        numRef: codiQrs.numRef,
        chargeId: charges.id,
        chargeStatus: charges.status,
        amountCents: charges.amountCents,
        bankAccountId: merchants.peyBankAccountId,
      })
      .from(codiQrs)
      .innerJoin(charges, eq(charges.id, codiQrs.chargeId))
      .innerJoin(merchants, eq(merchants.id, charges.merchantId))
      .where(eq(codiQrs.peyQrId, notice.codiQrId))
      .limit(1);

    if (!qr) {
      await finishIncident(tx, {
        eventId,
        now,
        type: "unknown_qr",
        reason: "Pey avisó un pago de un QR que CobraVoz no tiene registrado.",
      });
      return { outcome: "incident", duplicate: false };
    }

    const mismatches = mismatchesOf(notice, qr);
    const reconciled = mismatches.length === 0;

    const [payment] = await tx
      .insert(payments)
      .values({
        codiQrId: qr.id,
        provider: PROVIDER,
        providerTransactionId: notice.transactionId,
        amountCents: notice.amountCents,
        reconciliationStatus: reconciled ? "reconciled" : "incident",
        evidenceSource: "webhook",
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
            eq(payments.providerTransactionId, notice.transactionId),
          ),
        )
        .limit(1);
      await tx
        .update(paymentEvents)
        .set({
          processingStatus: "ignored",
          codiQrId: qr.id,
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
        codiQrId: qr.id,
        paymentId: payment.id,
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(paymentEvents.id, eventId));

    if (!reconciled) {
      await tx.insert(paymentIncidents).values({
        chargeId: qr.chargeId,
        paymentId: payment.id,
        paymentEventId: eventId,
        type: mismatches.length === 1 ? mismatches[0] : "other",
        reason: mismatches.map((item) => MISMATCH_LABEL[item]).join(" "),
      });
      await tx
        .update(charges)
        .set({ status: "incident", updatedAt: now })
        .where(
          and(
            eq(charges.id, qr.chargeId),
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
          eq(charges.id, qr.chargeId),
          inArray(charges.status, [...PAYABLE_STATUSES]),
        ),
      );

    return { outcome: "paid", duplicate: false };
  });
}

function mismatchesOf(
  notice: PeyPaymentNotice,
  qr: { amountCents: number; numRef: number; bankAccountId: string },
): Mismatch[] {
  const found: Mismatch[] = [];
  if (notice.amountCents !== qr.amountCents) found.push("amount_mismatch");
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
    type: "unknown_qr";
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
