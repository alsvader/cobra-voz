/** Estados de dominio del cobro (`charge_status`). */
export type ChargeStatus =
  | "created"
  | "qr_uncertain"
  | "waiting_payment"
  | "paid"
  | "expired"
  | "locally_closed"
  | "incident";

/**
 * Cobro tal como llega al cliente. Lista blanca explícita: nunca incluye
 * `merchantId`, `pey_qr_id`, `numRef` ni datos de cuenta.
 */
export type ChargeDto = {
  id: string;
  /** Referencia humana `CV-XXXXXXXX`. */
  reference: string;
  amountCents: number;
  currency: "MXN";
  status: ChargeStatus;
  /** `qr` muestra un código. `pn` envió el aviso. `link` creó un enlace. */
  collectionMethod: "qr" | "pn" | "link";
  /** Últimos 4 dígitos cuando el cobro es por notificación. */
  phoneLast4: string | null;
  /**
   * `rejected`: Pey respondió 400 y el enlace no existe.
   * `uncertain`: no se sabe si Pey creó el instrumento.
   */
  creationResult?: "uncertain" | "rejected" | null;
  /** Enlace para copiar. Solo cuando Pey lo confirmó. */
  paymentLink?: { url: string } | null;
  createdAt: string;
  expiresAt: string | null;
  closedAt: string | null;
  /** Solo existe cuando Pey entregó un QR real (o de prueba, si `simulated`). */
  qr: {
    /** `qrString` persistido; el QR visual se dibuja a partir de él. */
    payload: string;
    expiresAt: string;
    /** `true` = QR del simulador (solo Local/Preview): debe rotularse «de prueba». */
    simulated: boolean;
  } | null;
};
