/**
 * Contrato del adaptador Pey / CoDi (Architecture §7).
 *
 * Los servicios de dominio solo conocen esta interfaz: la implementación real
 * (H5) y el simulador (Local/Preview) son intercambiables. El adaptador NUNCA
 * lanza para resultados de negocio: traduce todo a un `CreateQrOutcome`.
 */

export type CreateQrRequest = {
  /** UUID interno del cobro: viaja en `metadata` para correlacionar. */
  chargeId: string;
  /** Centavos enteros; el adaptador convierte a pesos con cuidado (sin float). */
  amountCents: number;
  /** Texto breve del cobro. */
  concept: string;
  /** Referencia numérica de Pey, 0..9 999 999 (≤ 7 dígitos). */
  numRef: number;
  /** Vigencia inicial del QR (600 s). */
  expirationSeconds: number;
  /** Cuenta receptora ya registrada en Pey (`bankAccountId`). */
  bankAccountId: string;
};

export type CreateQrOutcome =
  /** Pey devolvió un QR REAL con `id` y `qrString`. */
  | {
      status: "created";
      peyQrId: string;
      qrString: string;
      expiresAt: Date;
    }
  /**
   * Timeout, respuesta desconocida o malformada, error del proveedor… No se
   * sabe si Pey creó el QR. NO se reintenta a ciegas: Pey no documenta
   * idempotencia ni recuperación de un QR sin id (Architecture §7, §14).
   */
  | { status: "uncertain"; reason: string };

/**
 * Pago que Pey reporta al consultar un QR que CobraVoz YA conoce.
 * El adaptador solo devuelve pagos de ESE `peyQrId`: el servicio no acepta
 * un identificador distinto ni inventa uno que Pey nunca entregó.
 * `amountCents` ya es entero. La lista vigente de Pey no repite referencia ni
 * cuenta: esos campos llegan en null y la conciliación usa los del QR guardado.
 */
export type QueriedPayment = {
  transactionId: string;
  amountCents: number;
  numRef: number | null;
  bankAccountId: string | null;
  paidAt: Date;
};

export type QueryQrPaymentsOutcome =
  | { status: "ok"; payments: QueriedPayment[] }
  /** Timeout o error del proveedor. No es «no hubo pago» y no acredita nada. */
  | { status: "unavailable"; reason: string };

export type CreatePushRequest = {
  chargeId: string;
  amountCents: number;
  concept: string;
  numRef: number;
  expirationSeconds: number;
  bankAccountId: string;
  /** Celular mexicano de 10 dígitos, sin lada. */
  phoneNumber: string;
};

export type CreatePushOutcome =
  | {
      status: "created";
      transactionId: string;
      /** Folio de 20 dígitos asignado por Banxico. */
      codiId: string;
      expiresAt: Date;
    }
  /** Timeout o respuesta sin identificadores. No se reintenta a ciegas. */
  | { status: "uncertain"; reason: string };

/**
 * Consulta de `GET /transaction/:id` para una notificación ya creada.
 * `payment` en null significa que Pey respondió y el pago sigue pendiente.
 * `chargeId` sale de `metadata.externalMetadata` cuando Pey lo devuelve.
 */
export type QueryPushPaymentOutcome =
  | {
      status: "ok";
      payment: QueriedPayment | null;
      chargeId: string | null;
    }
  | { status: "unavailable"; reason: string };

export type CreatePaymentLinkRequest = {
  chargeId: string;
  /** Importe capturado. El enlace cobra esto, no el centavo del QR. */
  amountCents: number;
  expirationSeconds: number;
  successUrl: string;
  backUrl: string;
};

export type CreatePaymentLinkOutcome =
  | {
      status: "created";
      peyPaymentLinkId: string;
      url: string;
      expiresAt: Date;
    }
  /** Pey respondió 400: el enlace no existe. No se reintenta esta intención. */
  | { status: "rejected"; errorType: string }
  /** 500, timeout o un 200 sin id ni url. No se reintenta a ciegas. */
  | { status: "uncertain"; reason: string };

export type PaymentLinkTransaction = {
  transactionId: string;
  /** Dinero liquidado, en centavos. */
  amountCents: number;
  /** `amountBreakdown.base`, o el total si Pey no lo separa. */
  baseCents: number;
  paidAt: Date;
};

export type QueryPaymentLinkOutcome =
  | {
      status: "ok";
      state: "pending" | "processing" | "partial" | "paid";
      transaction: PaymentLinkTransaction | null;
    }
  | { status: "unavailable"; reason: string };

export interface PeyAdapter {
  /** Identifica la implementación (logs y rotulado de QR de prueba). */
  readonly kind: "mock" | "real";
  /** Una única llamada a `POST /codi/qr`. Sin reintentos internos. */
  createCodiQr(request: CreateQrRequest): Promise<CreateQrOutcome>;
  /**
   * `GET /transaction/codi/qr/:id` (Architecture §9). Solo con un id que Pey
   * ya devolvió. Sin id no hay nada que consultar.
   */
  queryCodiQrPayments(peyQrId: string): Promise<QueryQrPaymentsOutcome>;
  /** Una única llamada a `POST /codi/pn`. Sin reintentos internos. */
  createCodiPush(request: CreatePushRequest): Promise<CreatePushOutcome>;
  /**
   * `GET /transaction/:id` del `transactionId` que Pey devolvió al crear la
   * notificación. Sin ese id no hay nada que consultar.
   */
  queryCodiPushPayment(transactionId: string): Promise<QueryPushPaymentOutcome>;
  /** Una única llamada a `POST /payment-link/create`. Sin reintentos internos. */
  createPaymentLink(
    request: CreatePaymentLinkRequest,
  ): Promise<CreatePaymentLinkOutcome>;
  /**
   * `GET /payment-link/:id` de un enlace que Pey ya devolvió. Sin id no hay
   * nada que consultar.
   */
  queryPaymentLink(peyPaymentLinkId: string): Promise<QueryPaymentLinkOutcome>;
}
