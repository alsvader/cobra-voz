export type CounterPaymentDto = {
  id: string;
  amountCents: number;
};

/**
 * Importe del pago de prueba en local. $10.00 se oye claro y no se confunde
 * con un cobro de un centavo.
 */
export const COUNTER_TEST_PAYMENT_CENTS = 1000;
