import { isValidAmountCents } from "@/modules/charges/amount";

/**
 * Centavos → palabras en español de México, sin símbolos ni comas.
 * Es el importe que se dice al confirmar un pago. No interpreta voz.
 */

const UNITS = [
  "cero",
  "un",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
] as const;

const TEENS = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
] as const;

const TENS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
] as const;

const VEINTI = [
  "",
  "veintiún",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
] as const;

const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
] as const;

/** 0–99. El 1 queda en «un» para ir delante de peso, mil o centavo. */
function underHundred(n: number): string {
  if (n < 10) return UNITS[n] ?? "";
  if (n < 20) return TEENS[n - 10] ?? "";
  if (n < 30) return n === 20 ? "veinte" : (VEINTI[n - 20] ?? "");
  const ten = Math.trunc(n / 10);
  const one = n % 10;
  const head = TENS[ten] ?? "";
  if (one === 0) return head;
  return `${head} y ${UNITS[one]}`;
}

/** 0–999. «cien» solo cuando el grupo es exactamente 100. */
function underThousand(n: number): string {
  if (n < 100) return underHundred(n);
  if (n === 100) return "cien";
  const hundreds = Math.trunc(n / 100);
  const rest = n % 100;
  const head = HUNDREDS[hundreds] ?? "";
  if (rest === 0) return head;
  return `${head} ${underHundred(rest)}`;
}

/** 1–999_999. «mil» no lleva «un» delante. */
function underMillion(n: number): string {
  if (n < 1000) return underThousand(n);
  const thousands = Math.trunc(n / 1000);
  const rest = n % 1000;
  const head = thousands === 1 ? "mil" : `${underThousand(thousands)} mil`;
  if (rest === 0) return head;
  return `${head} ${underThousand(rest)}`;
}

/**
 * `15000` → «ciento cincuenta pesos».
 * `7550` → «setenta y cinco pesos con cincuenta centavos».
 * `1` → «un centavo». Devuelve `null` si el entero no es un importe válido.
 */
export function amountInWords(cents: number): string | null {
  if (!isValidAmountCents(cents)) return null;
  const pesos = Math.trunc(cents / 100);
  const centavos = cents % 100;
  const parts: string[] = [];
  if (pesos > 0) {
    parts.push(`${underMillion(pesos)} ${pesos === 1 ? "peso" : "pesos"}`);
  }
  if (centavos > 0) {
    parts.push(
      `${underHundred(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`,
    );
  }
  return parts.join(" con ") || null;
}
