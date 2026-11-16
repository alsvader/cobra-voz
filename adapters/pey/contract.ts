/**
 * Importe que el cliente real escribe en cada QR.
 * El cobro guarda el importe capturado en la app; el banco solo mueve esto.
 * Pey pide probar en producción con $0.01 (docs.pey.mx, OpenAPI 2026-10-20).
 */
export const REAL_QR_AMOUNT_CENTS = 1;

/** `1` → `0.01`, armado con enteros. No pasa por un float. */
export function centsToPeyAmountToken(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const fraction = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}
