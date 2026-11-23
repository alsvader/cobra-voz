import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  // react-hot-toast llama a matchMedia al montar el Toaster.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  toast.removeAll();
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
    expect(await screen.findByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText("QR de mostrador")).toBeInTheDocument();
    expect(screen.getAllByText("$10.00")).toHaveLength(2);
    expect(announceVerifiedPayment).toHaveBeenCalledWith(sale);

    await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    await waitFor(() => {
      expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
    });
    expect(screen.getByText("$10.00")).toBeInTheDocument();
  });

  it("no avisa los pagos que ya estaban al abrir", () => {
    render(
      <CounterScreen
        merchantName="Minino Coffee"
        payload={payload}
        simulated
        initialPayments={[
          {
            id: "00000000-0000-4000-8000-000000000011",
            amountCents: 2500,
          },
        ]}
      />,
    );

    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
    expect(announceVerifiedPayment).not.toHaveBeenCalled();
  });
});
