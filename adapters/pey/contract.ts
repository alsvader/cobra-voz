/**
 * Importe que el cliente real escribe en cada QR.
 * El cobro guarda el importe capturado en la app; el banco solo mueve esto.
 * Pey pide probar en producción con $0.01 (docs.pey.mx, OpenAPI 2026-10-20).
 */
export const REAL_QR_AMOUNT_CENTS = 1;

/**
 * Folio que devuelve Pey. La documentación dice 20 dígitos; en producción
 * también llega un token de 20 con letras. Se guarda tal cual, salvo cuando
 * son 20 dígitos separados por espacios o guiones.
 */
const CODI_ID_TOKEN = /^[A-Za-z0-9][A-Za-z0-9+/=._:-]{0,63}$/;

export function canonicalCodiId(value: string): string | null {
  const token = value.normalize("NFKC").trim();
  const digits = token.replace(/[\s-]/g, "");
  if (/^[0-9]{20}$/.test(digits) && /^[0-9\s-]+$/u.test(token)) return digits;
  if (CODI_ID_TOKEN.test(token)) return token;
  return null;
}

/** `1` → `0.01`, armado con enteros. No pasa por un float. */
export function centsToPeyAmountToken(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const fraction = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}
