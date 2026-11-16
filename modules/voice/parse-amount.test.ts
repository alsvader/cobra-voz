import { describe, expect, it } from "vitest";
import { parseSpokenAmount } from "./parse-amount";

function cents(phrase: string): number {
  const parsed = parseSpokenAmount(phrase);
  if (!parsed.ok) throw new Error(`${phrase} → ${parsed.error}`);
  return parsed.cents;
}

function error(phrase: string): string {
  const parsed = parseSpokenAmount(phrase);
  if (parsed.ok) throw new Error(`${phrase} → ${parsed.cents}`);
  return parsed.error;
}

describe("parseSpokenAmount", () => {
  it("acepta cifras y palabras de un solo importe", () => {
    expect(cents("150")).toBe(15_000);
    expect(cents("150.50")).toBe(15_050);
    expect(cents("150,50")).toBe(15_050);
    expect(cents("1,500")).toBe(150_000);
    expect(cents("ciento y cincuenta")).toBe(15_000);
    expect(cents("mil y quinientos")).toBe(150_000);
    expect(cents("ciento cincuenta pesos")).toBe(15_000);
    expect(cents("setenta y cinco con cincuenta")).toBe(7_550);
    expect(cents("setenta y cinco pesos con cincuenta centavos")).toBe(7_550);
    expect(cents("ciento cincuenta punto cincuenta")).toBe(15_050);
    expect(cents("ciento cincuenta punto cinco")).toBe(15_050);
    expect(cents("tres pesos con veinte")).toBe(320);
    expect(cents("un peso")).toBe(100);
    expect(cents("cero con cincuenta")).toBe(50);
    expect(cents("punto cincuenta")).toBe(50);
    expect(cents("veinticinco")).toBe(2_500);
    expect(cents("veintiún pesos")).toBe(2_100);
    expect(cents("cobra ciento cincuenta")).toBe(15_000);
    expect(cents("dos mil quinientos")).toBe(250_000);
    expect(cents("doscientos quince")).toBe(21_500);
  });

  it("rechaza vacío, cero, negativos, decimales de más y ambigüedad", () => {
    expect(error("")).toBe("empty");
    expect(error("   ")).toBe("empty");
    expect(error("pesos")).toBe("not_understood");
    expect(error("cero")).toBe("not_positive");
    expect(error("0")).toBe("not_positive");
    expect(error("menos diez")).toBe("not_positive");
    expect(error("150.555")).toBe("too_many_decimals");
    expect(error("ciento cincuenta punto cinco cinco cinco")).toBe(
      "too_many_decimals",
    );
    expect(error("ciento cincuenta y doscientos")).toBe("ambiguous");
    expect(error("150 o 200")).toBe("ambiguous");
    expect(error("ciento 50")).toBe("ambiguous");
    expect(error("con cien")).toBe("ambiguous");
  });
});
