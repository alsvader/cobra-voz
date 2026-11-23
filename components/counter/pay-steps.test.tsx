import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CounterPaySteps } from "./pay-steps";

describe("CounterPaySteps", () => {
  it("lista los tres pasos para pagar", () => {
    render(<CounterPaySteps />);

    const steps = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(steps).toEqual([
      "Entra a CoDi en la aplicación de tu banco",
      "Apunta la cámara a este código",
      "Captura el importe y autoriza el pago",
    ]);
  });
});
