import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  announceVerifiedPayment,
  primePaymentSpeech,
} from "@/adapters/speech/announce";
import type { CounterPaymentDto } from "@/modules/counter/types";
import { CounterScreen } from "./counter-screen";

const payload = "COBRAVOZ-MOCK|counter|merchant|0";

function payment(id: string, amountCents: number): CounterPaymentDto {
  return {
    id,
    amountCents,
    reference: `CV-${id.slice(0, 8).toUpperCase()}`,
    occurredAt: "2026-11-23T07:00:00.000Z",
    occurredLabel: "23 nov, 01:00",
  };
}

vi.mock("@/adapters/speech/announce", () => ({
  announceVerifiedPayment: vi.fn(),
  primePaymentSpeech: vi.fn(),
}));

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
    expect(
      screen.queryByRole("link", { name: "Ver todas las ventas" }),
    ).not.toBeInTheDocument();
  });

  it("al simular un pago lo muestra y pide el aviso de voz", async () => {
    const user = userEvent.setup();
    const sale = payment("00000000-0000-4000-8000-000000000010", 1000);
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
    expect(
      await screen.findByRole("button", { name: "Cerrar aviso" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Pagado").length).toBeGreaterThan(1);
    expect(screen.getByRole("link", { name: /\$10\.00/ })).toHaveTextContent(
      "QR de mostrador",
    );
    expect(screen.getAllByText("$10.00")).toHaveLength(2);
    expect(announceVerifiedPayment).toHaveBeenCalledWith(sale);

    await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cerrar aviso" }),
      ).not.toBeInTheDocument();
    });
    const row = screen.getByRole("link", { name: /\$10\.00/ });
    expect(row).toHaveAttribute("href", `/ventas/${sale.id}?desde=mostrador`);
    expect(row).toHaveTextContent("Pagado");
    expect(row).toHaveTextContent("QR de mostrador");
    expect(row).toHaveTextContent("23 nov, 01:00");
    expect(row).toHaveTextContent(sale.reference);
    expect(
      screen.getByRole("link", { name: "Ver todas las ventas" }),
    ).toHaveAttribute("href", "/ventas");
  });

  it("no avisa los pagos que ya estaban al abrir", () => {
    render(
      <CounterScreen
        merchantName="Minino Coffee"
        payload={payload}
        simulated
        initialPayments={[
          payment("00000000-0000-4000-8000-000000000011", 2500),
        ]}
      />,
    );

    const row = screen.getByRole("link", { name: /\$25\.00/ });
    expect(row).toHaveTextContent("Pagado");
    expect(row).toHaveTextContent("QR de mostrador");
    expect(
      screen.queryByRole("button", { name: "Cerrar aviso" }),
    ).not.toBeInTheDocument();
    expect(announceVerifiedPayment).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Ver todas las ventas" }),
    ).toHaveAttribute("href", "/ventas");
  });

  it("muestra cinco pagos y el enlace al historial completo", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      payment(`00000000-0000-4000-8000-00000000000${index}`, (index + 1) * 100),
    );
    render(
      <CounterScreen
        merchantName="Minino Coffee"
        payload={payload}
        simulated
        initialPayments={rows}
      />,
    );

    expect(screen.getAllByRole("link", { name: /\$/ })).toHaveLength(5);
    expect(screen.getByRole("link", { name: /\$1\.00/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /\$6\.00/ }),
    ).not.toBeInTheDocument();
    const salesLink = screen.getByRole("link", {
      name: "Ver todas las ventas",
    });
    const firstRow = screen.getByRole("link", { name: /\$1\.00/ });
    expect(salesLink).toHaveAttribute("href", "/ventas");
    expect(salesLink).toHaveTextContent("Ver todas");
    expect(
      salesLink.compareDocumentPosition(firstRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
