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
 * `amountCents` ya es entero; la implementación real (H5) convierte el texto
 * de Pey antes de cruzar esta frontera, sin pasar por punto flotante.
 */
export type QueriedPayment = {
  transactionId: string;
  amountCents: number;
  numRef: number;
  bankAccountId: string;
  paidAt: Date;
};

export type QueryQrPaymentsOutcome =
  | { status: "ok"; payments: QueriedPayment[] }
  /** Timeout o error del proveedor. No es «no hubo pago» y no acredita nada. */
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
}
