import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps, timestamptz } from "./columns";
import {
  chargeStatus,
  paymentEventProcessing,
  paymentEventValidation,
  paymentEvidenceSource,
  paymentIncidentStatus,
  paymentIncidentType,
  paymentReconciliationStatus,
} from "./enums";
import { merchants } from "./merchants";

/**
 * Intención de cobro. Se persiste ANTES de llamar a Pey (Architecture §7).
 * El importe son centavos enteros: nunca decimales binarios (ADR-14).
 */
export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("MXN"),
    status: chargeStatus("status").notNull().default("created"),
    /** Protección contra doble clic / peticiones duplicadas (RN-07). */
    idempotencyKey: text("idempotency_key").notNull(),
    /**
     * Pago verificado que dejó el cobro en `paid`. Sin él, la BD rechaza el
     * estado `paid` (no hay cobro confirmado sin evidencia verificada).
     */
    paidPaymentId: uuid("paid_payment_id").references(
      (): AnyPgColumn => payments.id,
      { onDelete: "restrict" },
    ),
    expiresAt: timestamptz("expires_at"),
    closedAt: timestamptz("closed_at"),
    /**
     * Último intento de consultar a Pey por este cobro (Architecture §9).
     * Se anota aunque la consulta no encuentre un pago, para no repetirla
     * en cada pasada del cron.
     */
    lastReconciliationAt: timestamptz("last_reconciliation_at"),
    /** `qr` muestra un código. `pn` envía el aviso al celular. */
    collectionMethod: text("collection_method").notNull().default("qr"),
    /**
     * SHA-256 del celular de 10 dígitos. Sirve para rechazar un reintento
     * con otro número. El número completo no se guarda.
     */
    phoneHash: text("phone_hash"),
    /** Últimos 4 dígitos, para mostrarlos en la pantalla de espera. */
    phoneLast4: text("phone_last4"),
    ...timestamps,
  },
  (table) => [
    unique("charges_merchant_idempotency_key").on(
      table.merchantId,
      table.idempotencyKey,
    ),
    index("charges_merchant_created_idx").on(table.merchantId, table.createdAt),
    index("charges_merchant_status_idx").on(table.merchantId, table.status),
    index("charges_expires_at_idx").on(table.expiresAt),
    index("charges_last_reconciliation_at_idx").on(table.lastReconciliationAt),
    check("charges_amount_cents_positive", sql`${table.amountCents} > 0`),
    check("charges_currency_mxn", sql`${table.currency} = 'MXN'`),
    check(
      "charges_paid_requires_payment",
      sql`${table.status} <> 'paid' OR ${table.paidPaymentId} IS NOT NULL`,
    ),
    check(
      "charges_locally_closed_requires_closed_at",
      sql`${table.status} <> 'locally_closed' OR ${table.closedAt} IS NOT NULL`,
    ),
    check(
      "charges_collection_method",
      sql`${table.collectionMethod} in ('qr', 'pn')`,
    ),
    check(
      "charges_phone_matches_method",
      sql`(
        ${table.collectionMethod} = 'qr'
        AND ${table.phoneHash} IS NULL
        AND ${table.phoneLast4} IS NULL
      ) OR (
        ${table.collectionMethod} = 'pn'
        AND ${table.phoneHash} ~ '^[0-9a-f]{64}$'
        AND ${table.phoneLast4} ~ '^[0-9]{4}$'
      )`,
    ),
  ],
).enableRLS();

/**
 * QR CoDi REAL devuelto por Pey. Existe una fila solo cuando Pey entregó
 * `id` y `qrString`: si la creación quedó incierta el cobro no tiene fila
 * aquí (RN-09). `charge_id` único = 1:0..1 con el cobro.
 */
export const codiQrs = pgTable(
  "codi_qrs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargeId: uuid("charge_id")
      .notNull()
      .unique("codi_qrs_charge_id_key")
      .references(() => charges.id, { onDelete: "restrict" }),
    peyQrId: text("pey_qr_id").notNull().unique("codi_qrs_pey_qr_id_key"),
    /** Referencia numérica de Pey (`numRef`, ≤7 dígitos). Puede reutilizarse. */
    numRef: integer("num_ref").notNull(),
    /** `qrString` real; el QR visual se dibuja desde aquí, nunca se sintetiza. */
    qrPayload: text("qr_payload").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("codi_qrs_num_ref_idx").on(table.numRef),
    check(
      "codi_qrs_num_ref_max_7_digits",
      sql`${table.numRef} BETWEEN 0 AND 9999999`,
    ),
  ],
).enableRLS();

/**
 * Notificación push de CoDi. Existe una fila solo cuando Pey respondió 200
 * con `transactionId` y `codiId`. Si la creación quedó incierta, el cobro no
 * tiene fila aquí y no se reintenta. `charge_id` único = 1:0..1 con el cobro.
 */
export const codiNotifications = pgTable(
  "codi_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargeId: uuid("charge_id")
      .notNull()
      .unique("codi_notifications_charge_id_key")
      .references(() => charges.id, { onDelete: "restrict" }),
    /** ULID que Pey devuelve al crear y que el webhook repite. */
    peyTransactionId: text("pey_transaction_id")
      .notNull()
      .unique("codi_notifications_pey_transaction_id_key"),
    /** Folio que Pey asigna al aviso. 20 dígitos o un token con letras. */
    codiId: text("codi_id").notNull().unique("codi_notifications_codi_id_key"),
    numRef: integer("num_ref").notNull(),
    phoneLast4: text("phone_last4").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("codi_notifications_num_ref_idx").on(table.numRef),
    check(
      "codi_notifications_num_ref_max_7_digits",
      sql`${table.numRef} BETWEEN 0 AND 9999999`,
    ),
    check(
      "codi_notifications_phone_last4",
      sql`${table.phoneLast4} ~ '^[0-9]{4}$'`,
    ),
    check(
      "codi_notifications_codi_id_token",
      sql`${table.codiId} ~ '^[A-Za-z0-9][A-Za-z0-9+/=._:-]{0,63}$'`,
    ),
  ],
).enableRLS();

/**
 * Movimiento bancario externo. Apunta a un QR o a una notificación, nunca a
 * los dos. `paid_at` es el instante real del pago; `recorded_at` es cuándo lo
 * persistió CobraVoz: los totales usan `paid_at`.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codiQrId: uuid("codi_qr_id").references(() => codiQrs.id, {
      onDelete: "restrict",
    }),
    codiNotificationId: uuid("codi_notification_id").references(
      (): AnyPgColumn => codiNotifications.id,
      { onDelete: "restrict" },
    ),
    provider: text("provider").notNull().default("pey"),
    providerTransactionId: text("provider_transaction_id").notNull(),
    /** Importe REALMENTE recibido (puede diferir del solicitado → incidencia). */
    amountCents: integer("amount_cents").notNull(),
    reconciliationStatus: paymentReconciliationStatus(
      "reconciliation_status",
    ).notNull(),
    evidenceSource: paymentEvidenceSource("evidence_source").notNull(),
    paidAt: timestamptz("paid_at").notNull(),
    recordedAt: timestamptz("recorded_at").notNull().defaultNow(),
    reconciledAt: timestamptz("reconciled_at"),
    ...timestamps,
  },
  (table) => [
    unique("payments_provider_transaction_key").on(
      table.provider,
      table.providerTransactionId,
    ),
    index("payments_codi_qr_id_idx").on(table.codiQrId),
    index("payments_codi_notification_id_idx").on(table.codiNotificationId),
    index("payments_paid_at_idx").on(table.paidAt),
    index("payments_reconciliation_status_idx").on(table.reconciliationStatus),
    check("payments_amount_cents_positive", sql`${table.amountCents} > 0`),
    check(
      "payments_reconciled_requires_reconciled_at",
      sql`${table.reconciliationStatus} <> 'reconciled' OR ${table.reconciledAt} IS NOT NULL`,
    ),
    check(
      "payments_one_instrument",
      sql`(
        ${table.codiQrId} IS NOT NULL AND ${table.codiNotificationId} IS NULL
      ) OR (
        ${table.codiQrId} IS NULL AND ${table.codiNotificationId} IS NOT NULL
      )`,
    ),
  ],
).enableRLS();

/**
 * Entregas de webhook con firma ya validada. `(provider, webhook_id)` único
 * implementa la idempotencia por entrega; no sustituye la unicidad por
 * `provider_transaction_id` en `payments`. Sin cuerpo crudo: los payloads
 * completos no se guardan (logs sin datos sensibles).
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("pey"),
    webhookId: text("webhook_id").notNull(),
    eventType: text("event_type").notNull(),
    validationStatus: paymentEventValidation("validation_status").notNull(),
    processingStatus: paymentEventProcessing("processing_status")
      .notNull()
      .default("pending"),
    providerTransactionId: text("provider_transaction_id"),
    /** `codiQrId` tal como lo reporta Pey; puede ser un QR desconocido. */
    providerQrId: text("provider_qr_id"),
    codiQrId: uuid("codi_qr_id").references(() => codiQrs.id, {
      onDelete: "restrict",
    }),
    codiNotificationId: uuid("codi_notification_id").references(
      () => codiNotifications.id,
      { onDelete: "restrict" },
    ),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "restrict",
    }),
    receivedAt: timestamptz("received_at").notNull().defaultNow(),
    processedAt: timestamptz("processed_at"),
    ...timestamps,
  },
  (table) => [
    unique("payment_events_provider_webhook_key").on(
      table.provider,
      table.webhookId,
    ),
    index("payment_events_provider_transaction_idx").on(
      table.providerTransactionId,
    ),
    index("payment_events_codi_qr_id_idx").on(table.codiQrId),
    index("payment_events_codi_notification_id_idx").on(
      table.codiNotificationId,
    ),
    index("payment_events_processing_status_idx").on(table.processingStatus),
  ],
).enableRLS();

/**
 * Anomalías que requieren conciliación (RN-14). Debe apuntar al menos a un
 * cobro, pago o evento.
 */
export const paymentIncidents = pgTable(
  "payment_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargeId: uuid("charge_id").references(() => charges.id, {
      onDelete: "restrict",
    }),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "restrict",
    }),
    paymentEventId: uuid("payment_event_id").references(
      () => paymentEvents.id,
      { onDelete: "restrict" },
    ),
    type: paymentIncidentType("type").notNull(),
    reason: text("reason").notNull(),
    status: paymentIncidentStatus("status").notNull().default("open"),
    resolvedAt: timestamptz("resolved_at"),
    ...timestamps,
  },
  (table) => [
    index("payment_incidents_charge_id_idx").on(table.chargeId),
    index("payment_incidents_payment_id_idx").on(table.paymentId),
    index("payment_incidents_status_idx").on(table.status),
    check(
      "payment_incidents_has_reference",
      sql`${table.chargeId} IS NOT NULL OR ${table.paymentId} IS NOT NULL OR ${table.paymentEventId} IS NOT NULL`,
    ),
    check(
      "payment_incidents_resolved_requires_resolved_at",
      sql`${table.status} <> 'resolved' OR ${table.resolvedAt} IS NOT NULL`,
    ),
  ],
).enableRLS();
