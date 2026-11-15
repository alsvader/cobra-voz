import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Estados de dominio del cobro (Architecture §4 «Estados y semántica»).
 *
 * - «Generando QR» NO se persiste: es un estado transitorio de interfaz
 *   (`created` + solicitud a Pey en curso).
 * - `qr_uncertain` es el estado TÉCNICO INTERNO previsto por la arquitectura
 *   para «creación externa incierta»: el cobro existe pero Pey no devolvió un
 *   QR confirmado (timeout / respuesta desconocida). No hay fila en
 *   `codi_qrs` y no se reintenta de forma automática.
 * - «Verificación no disponible» es un estado de comunicación, no de cobro.
 * - `expired` y `locally_closed` siguen pudiendo recibir pago tardío.
 */
export const chargeStatus = pgEnum("charge_status", [
  "created",
  "qr_uncertain",
  "waiting_payment",
  "paid",
  "expired",
  "locally_closed",
  "incident",
]);

/** Resultado de conciliar un pago: solo `reconciled` suma a ventas (RN-16). */
export const paymentReconciliationStatus = pgEnum(
  "payment_reconciliation_status",
  ["reconciled", "incident"],
);

/** Evidencia con la que se verificó el pago. */
export const paymentEvidenceSource = pgEnum("payment_evidence_source", [
  "webhook",
  "provider_query",
]);

/**
 * Validación de un webhook. Solo se persisten entregas con firma válida:
 * una firma inválida se rechaza sin guardar nada, para que un atacante no
 * pueda «quemar» un `webhook-id` legítimo en la deduplicación.
 */
export const paymentEventValidation = pgEnum("payment_event_validation", [
  "verified",
  "mismatch",
]);

export const paymentEventProcessing = pgEnum("payment_event_processing", [
  "pending",
  "applied",
  "incident",
  "ignored",
]);

export const paymentIncidentType = pgEnum("payment_incident_type", [
  "amount_mismatch",
  "unknown_qr",
  "account_mismatch",
  "reference_mismatch",
  "late_payment",
  "qr_creation_uncertain",
  "other",
]);

export const paymentIncidentStatus = pgEnum("payment_incident_status", [
  "open",
  "investigating",
  "resolved",
]);
