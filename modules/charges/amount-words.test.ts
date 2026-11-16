import { describe, expect, it } from "vitest";
import { parseSpokenAmount } from "@/modules/voice/parse-amount";
import { amountInWords } from "./amount-words";

describe("amountInWords", () => {
  it.each([
    [100, "un peso"],
    [2_100, "veintiún pesos"],
    [15_000, "ciento cincuenta pesos"],
    [7_550, "setenta y cinco pesos con cincuenta centavos"],
    [1, "un centavo"],
    [50, "cincuenta centavos"],
    [101, "un peso con un centavo"],
    [10_100, "ciento un pesos"],
    [1_600, "dieciséis pesos"],
    [100_000, "mil pesos"],
    [150_025, "mil quinientos pesos con veinticinco centavos"],
    [2_100_000, "veintiún mil pesos"],
    [10_100_000, "ciento un mil pesos"],
  ])("%i → %s", (cents, text) => {
    expect(amountInWords(cents)).toBe(text);
  });

  it("dice el importe máximo admitido", () => {
    expect(amountInWords(99_999_999)).toBe(
      "novecientos noventa y nueve mil novecientos noventa y nueve pesos con noventa y nueve centavos",
    );
  });

  it("rechaza cero, negativos y lo que no es un importe", () => {
    expect(amountInWords(0)).toBeNull();
    expect(amountInWords(-100)).toBeNull();
    expect(amountInWords(1.5)).toBeNull();
    expect(amountInWords(100_000_000)).toBeNull();
  });

  it("el parser vuelve a leer los pesos que esta función dice", () => {
    for (const cents of [100, 2_100, 15_000, 7_550, 150_025, 2_100_000]) {
      const words = amountInWords(cents);
      const parsed = parseSpokenAmount(words ?? "");
      expect(parsed).toEqual({ ok: true, cents });
    }
  });
});
