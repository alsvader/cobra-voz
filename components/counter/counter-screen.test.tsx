import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  announceVerifiedPayment,
  primePaymentSpeech,
} from "@/adapters/speech/announce";
import { CounterScreen } from "./counter-screen";

vi.mock("@/adapters/speech/announce", () => ({
  announceVerifiedPayment: vi.fn(),
  primePaymentSpeech: vi.fn(),
}));

const payload = "COBRAVOZ-MOCK|counter|merchant|0";

function screenOf(allowTestPayment: boolean) {
  return render(
    <CounterScreen
      merchantName="Minino Coffee"
      payload={payload}
      simulated
      initialPayments={[]}
      allowTestPayment={allowTestPayment}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CounterScreen", () => {
  it("oculta el pago de prueba fuera de local", () => {
    screenOf(false);
    expect(
      screen.queryByRole("button", { name: /simular un pago/i }),
    ).not.toBeInTheDocument();
  });

  it("al simular un pago lo muestra y pide el aviso de voz", async () => {
    const user = userEvent.setup();
    const sale = {
      id: "00000000-0000-4000-8000-000000000010",
      amountCents: 1000,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/test-payment") && init?.method === "POST") {
          return Response.json({ payment: sale }, { status: 201 });
        }
        return Response.json({ payments: [sale] });
      }),
    );
    screenOf(true);

    await user.click(
      screen.getByRole("button", { name: "Simular un pago de $10.00" }),
    );

    expect(primePaymentSpeech).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("$10.00")).toBeInTheDocument();
    expect(announceVerifiedPayment).toHaveBeenCalledWith(sale);
  });
});
