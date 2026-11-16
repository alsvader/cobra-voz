/**
 * Convierte una frase en español (México) a centavos enteros.
 * Determinista: un solo importe, mayor que cero, con máximo dos decimales.
 * Si hay duda, rechaza. Nunca inventa una cifra.
 */

export type SpokenAmountError =
  | "empty"
  | "not_understood"
  | "ambiguous"
  | "not_positive"
  | "too_many_decimals"
  | "too_large";

export type SpokenAmount =
  | { ok: true; cents: number }
  | { ok: false; error: SpokenAmountError };

/** Mismo tope que la captura manual. */
const MAX_AMOUNT_CENTS = 99_999_999;

const UNITS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};

const TEENS: Record<string, number> = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
};

const TENS: Record<string, number> = {
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const VEINTI: Record<string, number> = {
  veintiuno: 21,
  veintiun: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};

const HUNDREDS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};

const FILLER =
  /^(?:quiero|quisiera|cobrame|cobrar|cobra|son|que|me|por|favor|a|de|la|el|los|las|importe|cantidad)$/;

type Fail = Exclude<SpokenAmountError, "empty">;

type Words = { ok: true; value: number } | { ok: false; error: Fail };

export function parseSpokenAmount(input: string): SpokenAmount {
  const normalized = input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[$]/g, " ")
    .replace(/[^a-z0-9.,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return { ok: false, error: "empty" };
  if (/\b(?:menos|negativo)\b/.test(normalized) || normalized.startsWith("-")) {
    return { ok: false, error: "not_positive" };
  }

  const stripped = normalized
    .replace(/\b(?:pesos|peso|centavos|centavo|mxn|mexicanos|mexicano)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) return { ok: false, error: "not_understood" };
  if (/\bo\b/.test(stripped)) return { ok: false, error: "ambiguous" };

  const conParts = stripped.split(/\bcon\b/).map((part) => part.trim());
  if (conParts.length > 2) return { ok: false, error: "ambiguous" };

  if (conParts.length === 2 && /\bpunto\b|\d\s*[.,]\s*\d/.test(stripped)) {
    return { ok: false, error: "ambiguous" };
  }

  const left = dropFiller(conParts[0] ?? "");
  const pesos = left
    ? parseClause(left)
    : ({ ok: true as const, value: 0 });
  if (!pesos.ok) return pesos;

  let cents = pesos.value;
  if (conParts.length === 2) {
    const fraction = parseCentsWords(dropFiller(conParts[1] ?? ""));
    if (!fraction.ok) return fraction;
    cents += fraction.value;
  }

  return finish(cents);
}

function dropFiller(text: string): string {
  const tokens = text.split(" ").filter(Boolean);
  while (tokens.length > 0 && tokens[0] && FILLER.test(tokens[0])) {
    tokens.shift();
  }
  while (
    tokens.length > 0 &&
    tokens[tokens.length - 1] &&
    FILLER.test(tokens[tokens.length - 1]!)
  ) {
    tokens.pop();
  }
  return tokens.join(" ");
}

function parseClause(text: string): Words {
  if (!text) return { ok: false, error: "not_understood" };
  const decimal = splitDecimal(text);
  if (!decimal.ok) return decimal;

  const whole = decimal.whole
    ? parseWhole(decimal.whole)
    : ({ ok: true as const, value: 0 });
  if (!whole.ok) return whole;
  if (decimal.fraction === null) return { ok: true, value: whole.value * 100 };

  const fraction = parseFraction(decimal.fraction);
  if (!fraction.ok) return fraction;
  return { ok: true, value: whole.value * 100 + fraction.value };
}

function parseCentsWords(text: string): Words {
  if (!text) return { ok: false, error: "not_understood" };
  if (/\bpunto\b|\d\s*[.,]\s*\d/.test(text)) {
    return { ok: false, error: "ambiguous" };
  }
  const parsed = parseWhole(text);
  if (!parsed.ok) return parsed;
  if (parsed.value > 99) return { ok: false, error: "ambiguous" };
  return parsed;
}

/** Separa enteros y decimales. El punto es decimal; la coma de miles se quita. */
function splitDecimal(
  text: string,
): { ok: true; whole: string; fraction: string | null } | { ok: false; error: Fail } {
  let source = text.replace(/(\d),(\d{3})\b/g, "$1$2");
  source = source.replace(/(\d),(\d{3})\b/g, "$1$2");
  if (/\d\.\d{3,}/.test(source)) return { ok: false, error: "too_many_decimals" };
  source = source.replace(/\bpunto\b/g, " . ");
  source = source.replace(/(\d),(\d{1,2})\b/g, "$1 . $2");
  source = source.replace(/(\d)\.(\d{1,2})\b/g, "$1 . $2");
  source = source.replace(/\s+/g, " ").trim();

  const pieces = source.split(/\s*\.\s*/);
  if (pieces.length > 2) return { ok: false, error: "too_many_decimals" };
  const whole = pieces[0]?.trim() ?? "";
  const fraction = pieces[1]?.trim() ?? null;
  if (!whole && !fraction) return { ok: false, error: "not_understood" };
  return { ok: true, whole, fraction: fraction === "" ? null : fraction };
}

function parseFraction(text: string): Words {
  if (!text) return { ok: false, error: "not_understood" };
  if (/^\d{3,}$/.test(text)) return { ok: false, error: "too_many_decimals" };
  if (/^\d{1,2}$/.test(text)) {
    const cents = text.length === 1 ? Number(text) * 10 : Number(text);
    return { ok: true, value: cents };
  }
  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length !== 1) return { ok: false, error: "too_many_decimals" };
  const token = tokens[0]!;
  const value = UNITS[token] ?? TEENS[token] ?? TENS[token] ?? VEINTI[token];
  if (value === undefined || value > 99) {
    return { ok: false, error: "not_understood" };
  }
  // «punto cinco» es 0.5; «punto quince» y «punto cincuenta» son centavos.
  return { ok: true, value: token in UNITS ? value * 10 : value };
}

function parseWhole(text: string): Words {
  if (!text) return { ok: false, error: "not_understood" };
  if (/[a-z]/.test(text) && /\d/.test(text)) {
    return { ok: false, error: "ambiguous" };
  }
  if (!/[a-z]/.test(text)) return parseDigits(text);
  return parseWords(text);
}

function parseDigits(text: string): Words {
  const compact = text.replace(/\s+/g, "");
  if (!/^\d+$/.test(compact)) return { ok: false, error: "not_understood" };
  if (compact.length > 8) return { ok: false, error: "too_large" };
  return { ok: true, value: Number(compact) };
}

function parseWords(text: string): Words {
  const tokens = text.split(" ").filter(Boolean);
  let total = 0;
  let current = 0;
  let expectAnd = false;

  const fail = (error: Fail): Words => ({ ok: false, error });

  for (const token of tokens) {
    if (token === "y") {
      const afterHundred = current !== 0 && current % 100 === 0;
      const afterThousand = current === 0 && total !== 0;
      if (!expectAnd && !afterHundred && !afterThousand) {
        return fail("not_understood");
      }
      expectAnd = false;
      continue;
    }
    if (expectAnd) return fail("ambiguous");

    if (token === "mil") {
      const base = current === 0 ? 1 : current;
      if (total !== 0) return fail("ambiguous");
      total += base * 1000;
      current = 0;
      continue;
    }

    const hundred = HUNDREDS[token];
    if (hundred !== undefined) {
      if (current !== 0) return fail("ambiguous");
      current = hundred;
      expectAnd = false;
      continue;
    }

    const twenty = VEINTI[token];
    if (twenty !== undefined) {
      if (current % 100 !== 0) return fail("ambiguous");
      current += twenty;
      expectAnd = false;
      continue;
    }

    const ten = TENS[token];
    if (ten !== undefined) {
      if (current % 100 !== 0) return fail("ambiguous");
      current += ten;
      expectAnd = true;
      continue;
    }

    const teen = TEENS[token];
    if (teen !== undefined) {
      if (current % 100 !== 0) return fail("ambiguous");
      current += teen;
      expectAnd = false;
      continue;
    }

    const unit = UNITS[token];
    if (unit !== undefined) {
      if (current % 10 !== 0) return fail("ambiguous");
      current += unit;
      expectAnd = false;
      continue;
    }

    return fail("not_understood");
  }

  return { ok: true, value: total + current };
}

export function spokenTranscriptParam(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return cleaned || null;
}

function finish(cents: number): SpokenAmount {
  if (!Number.isInteger(cents)) return { ok: false, error: "too_many_decimals" };
  if (cents <= 0) return { ok: false, error: "not_positive" };
  if (cents > MAX_AMOUNT_CENTS) return { ok: false, error: "too_large" };
  return { ok: true, cents };
}
