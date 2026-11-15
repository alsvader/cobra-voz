/**
 * Importes en MXN: texto ⇄ centavos enteros.
 *
 * Reglas del PRD (RN-02): mayor que cero, MXN y como máximo dos decimales.
 * Todo el cálculo es con enteros: jamás se pasa por `float`, así `0.29`
 * produce exactamente 29 centavos (y no 28.999…). Este módulo es puro y se
 * comparte entre cliente (validación inmediata) y servidor (validación real).
 */

/**
 * Tope TÉCNICO de seguridad ($999,999.99): evita tecleos absurdos y cabe en la
 * columna `integer` de `charges.amount_cents`. NO es un límite de CoDi/Pey:
 * el máximo operativo real se confirmará con Pey (H5).
 */
export const MAX_AMOUNT_CENTS = 99_999_999;

export type AmountError =
  | "empty"
  | "invalid_format"
  | "decimal_comma"
  | "too_many_decimals"
  | "not_positive"
  | "too_large";

export type ParsedAmount =
  { ok: true; cents: number } | { ok: false; error: AmountError };

/** Mensajes para el comerciante: directos, con el siguiente paso claro. */
export const AMOUNT_ERROR_MESSAGES: Record<AmountError, string> = {
  empty: "Escribe el importe a cobrar.",
  invalid_format: "Escribe solo números, por ejemplo 150 o 150.50.",
  decimal_comma: "Usa punto para los centavos, por ejemplo 150.50.",
  too_many_decimals: "Usa máximo dos decimales, por ejemplo 150.50.",
  not_positive: "El importe debe ser mayor que $0.00.",
  too_large: "El importe es demasiado alto. Revisa que esté bien escrito.",
};

// Enteros con o sin separador de miles (1,500 / 1500) y decimales opcionales.
const AMOUNT_PATTERN = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d*))?$/;
// «150,5» / «150,50»: coma como decimal (no es el formato es-MX).
const DECIMAL_COMMA_PATTERN = /^\d+,\d{1,2}$/;

/** Interpreta lo que escribe una persona: «150», «$1,500.25», «150.5». */
export function parseAmountToCents(input: string): ParsedAmount {
  const text = input.replace(/\s+/g, "").replace(/^\$/, "");

  if (text === "") return { ok: false, error: "empty" };
  if (DECIMAL_COMMA_PATTERN.test(text)) {
    return { ok: false, error: "decimal_comma" };
  }

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) return { ok: false, error: "invalid_format" };

  const [, wholeRaw, fraction = ""] = match;
  if (fraction.length > 2) return { ok: false, error: "too_many_decimals" };

  const whole = wholeRaw.replaceAll(",", "");
  // Protege el entero antes de convertir: evita perder precisión en números enormes.
  if (whole.replace(/^0+/, "").length > 9) {
    return { ok: false, error: "too_large" };
  }

  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0) return { ok: false, error: "not_positive" };
  if (cents > MAX_AMOUNT_CENTS) return { ok: false, error: "too_large" };

  return { ok: true, cents };
}

/** Valida un entero de centavos ya calculado (p. ej. recibido por URL o API). */
export function isValidAmountCents(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_AMOUNT_CENTS
  );
}

/** Texto de URL → centavos, o `null` si no es un entero positivo válido. */
export function parseCentsParam(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const cents = Number(raw);
  return isValidAmountCents(cents) ? cents : null;
}

const WHOLE_FORMAT = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 0,
});

/** `15050` → «$150.50» (miles con coma, siempre dos decimales). */
export function formatMxn(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `$${WHOLE_FORMAT.format(whole)}.${fraction}`;
}

/** `15050` → «150.50»: valor editable para el campo de importe. */
export function centsToInputValue(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

/** `15050` → «150 pesos con 50 centavos»: lectura natural para lectores de pantalla. */
export function spokenMxn(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = cents % 100;
  const pesos = `${WHOLE_FORMAT.format(whole)} ${whole === 1 ? "peso" : "pesos"}`;
  if (fraction === 0) return pesos;
  return `${pesos} con ${fraction} ${fraction === 1 ? "centavo" : "centavos"}`;
}
