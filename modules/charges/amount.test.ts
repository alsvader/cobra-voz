import { describe, expect, it } from "vitest";
import {
  AMOUNT_ERROR_MESSAGES,
  MAX_AMOUNT_CENTS,
  centsToInputValue,
  formatMxn,
  isValidAmountCents,
  parseAmountToCents,
  parseCentsParam,
  pesosNumberToCents,
  spokenMxn,
} from "./amount";

describe("parseAmountToCents — importes válidos", () => {
  it.each([
    ["150", 15000],
    ["150.5", 15050],
    ["150.50", 15050],
    ["0.01", 1],
    ["0.99", 99],
    ["1,500", 150000],
    ["1,500.25", 150025],
    ["$1,500.25", 150025],
    ["  $ 80 ", 8000],
    ["150.", 15000],
    ["007", 700],
    ["999999.99", 99_999_999],
  ])("«%s» → %i centavos", (input, cents) => {
    expect(parseAmountToCents(input)).toEqual({ ok: true, cents });
  });

  it("es exacto donde los decimales binarios fallan", () => {
    // 0.29 * 100 === 28.999999999999996 en punto flotante.
    expect(parseAmountToCents("0.29")).toEqual({ ok: true, cents: 29 });
    expect(parseAmountToCents("19.99")).toEqual({ ok: true, cents: 1999 });
    expect(parseAmountToCents("1.15")).toEqual({ ok: true, cents: 115 });
    expect(parseAmountToCents("4.35")).toEqual({ ok: true, cents: 435 });
  });
});

describe("pesosNumberToCents", () => {
  it.each([
    [0.01, 1],
    [150.5, 15050],
    [1, 100],
    [0.29, 29],
    [19.99, 1999],
  ])("%s pesos → %i centavos", (pesos, cents) => {
    expect(pesosNumberToCents(pesos)).toEqual({ ok: true, cents });
  });

  it("rechaza cero y un número que no es de dos decimales", () => {
    expect(pesosNumberToCents(0).ok).toBe(false);
    expect(pesosNumberToCents(-1).ok).toBe(false);
    expect(pesosNumberToCents(10.555).ok).toBe(false);
    expect(pesosNumberToCents(Number.NaN).ok).toBe(false);
  });
});

describe("parseAmountToCents — rechazos", () => {
  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["$", "empty"],
    ["0", "not_positive"],
    ["0.00", "not_positive"],
    ["000", "not_positive"],
    ["10.123", "too_many_decimals"],
    ["1.005", "too_many_decimals"],
    ["150,50", "decimal_comma"],
    ["12,5", "decimal_comma"],
    ["-5", "invalid_format"],
    ["abc", "invalid_format"],
    ["12abc", "invalid_format"],
    ["1e3", "invalid_format"],
    ["1.2.3", "invalid_format"],
    [".50", "invalid_format"],
    ["1,5000", "invalid_format"],
    ["1,00", "decimal_comma"],
    ["$$5", "invalid_format"],
    ["1000000", "too_large"],
    ["999999.999", "too_many_decimals"],
    ["12345678901234567890", "too_large"],
  ])("«%s» → %s", (input, error) => {
    expect(parseAmountToCents(input)).toEqual({ ok: false, error });
  });

  it("el tope es exactamente MAX_AMOUNT_CENTS", () => {
    expect(parseAmountToCents("1000000.00")).toEqual({
      ok: false,
      error: "too_large",
    });
    expect(parseAmountToCents("999999.99")).toEqual({
      ok: true,
      cents: MAX_AMOUNT_CENTS,
    });
  });

  it("cada error tiene un mensaje en español sin jerga", () => {
    for (const message of Object.values(AMOUNT_ERROR_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/NaN|undefined|exception|error code/i);
    }
  });
});

describe("formatMxn / centsToInputValue", () => {
  it.each([
    [1, "$0.01"],
    [99, "$0.99"],
    [15000, "$150.00"],
    [15050, "$150.50"],
    [150025, "$1,500.25"],
    [99_999_999, "$999,999.99"],
  ])("%i centavos → %s", (cents, text) => {
    expect(formatMxn(cents)).toBe(text);
  });

  it("el valor del campo vuelve a parsearse al mismo importe (ida y vuelta)", () => {
    for (const cents of [1, 9, 10, 99, 100, 101, 15050, 150025, 99_999_999]) {
      const parsed = parseAmountToCents(centsToInputValue(cents));
      expect(parsed).toEqual({ ok: true, cents });
    }
  });

  it("formatMxn también es parseable de regreso", () => {
    for (const cents of [1, 15050, 150025, 99_999_999]) {
      expect(parseAmountToCents(formatMxn(cents))).toEqual({ ok: true, cents });
    }
  });
});

describe("centavos recibidos por URL o API", () => {
  it("acepta solo enteros positivos dentro del tope", () => {
    expect(parseCentsParam("15050")).toBe(15050);
    expect(parseCentsParam("1")).toBe(1);
    expect(parseCentsParam(String(MAX_AMOUNT_CENTS))).toBe(MAX_AMOUNT_CENTS);
  });

  it.each([
    undefined,
    null,
    "",
    "0",
    "-1",
    "1.5",
    "1e3",
    "abc",
    "100000000",
    "12345678901",
    "15050 ",
    "0x10",
  ])("rechaza %j", (raw) => {
    expect(parseCentsParam(raw)).toBeNull();
  });

  it("isValidAmountCents rechaza no enteros, NaN, Infinity y no numéricos", () => {
    for (const value of [0, -1, 1.5, NaN, Infinity, "100", null, undefined]) {
      expect(isValidAmountCents(value)).toBe(false);
    }
    expect(isValidAmountCents(100)).toBe(true);
  });
});

describe("spokenMxn", () => {
  it.each([
    [100, "1 peso"],
    [15000, "150 pesos"],
    [15050, "150 pesos con 50 centavos"],
    [101, "1 peso con 1 centavo"],
    [1, "0 pesos con 1 centavo"],
    [150025, "1,500 pesos con 25 centavos"],
  ])("%i → %s", (cents, text) => {
    expect(spokenMxn(cents)).toBe(text);
  });
});
