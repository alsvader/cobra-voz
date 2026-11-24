export type CounterPaymentDto = {
  id: string;
  amountCents: number;
  reference: string;
  /** `paid_at` del pago conciliado, en ISO. */
  occurredAt: string;
  /** Fecha en la zona del comercio, igual que el historial. */
  occurredLabel: string;
};

/**
 * Importe del pago de prueba en local. $10.00 se oye claro y no se confunde
 * con un cobro de un centavo.
 */
export const COUNTER_TEST_PAYMENT_CENTS = 1000;

/** Misma ventana que los movimientos recientes de Inicio. */
export const COUNTER_RECENT_LIMIT = 5;
