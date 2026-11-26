import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DailySummary } from "@/components/sales/daily-summary";
import { MovementHistory } from "@/components/sales/movement-history";
import { MovementStatusFilter } from "@/components/sales/movement-status-filter";
import { TransactionRow } from "@/components/sales/transaction-row";
import type { MovementDto } from "@/modules/sales/types";

const pending: MovementDto = {
  id: "3f2b8c1e-0000-4000-8000-000000000001",
  reference: "CV-3F2B8C1E",
  status: "waiting_payment",
  amountCents: 15050,
  occurredAt: "2026-11-15T18:00:00.000Z",
  occurredLabel: "15 nov, 12:00",
};

describe("DailySummary", () => {
  it("muestra el total del día y el número de pagos confirmados", () => {
    render(<DailySummary variant="full" totalCents={30050} count={2} />);

    expect(screen.getByText("Total cobrado hoy")).toBeInTheDocument();
    expect(screen.getByText("$300.50")).toBeInTheDocument();
    expect(screen.getByText("2 pagos confirmados")).toBeInTheDocument();
  });

  it("un día sin pagos conciliados dice $0.00 y cero pagos", () => {
    render(<DailySummary variant="compact" totalCents={0} count={0} />);

    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText("0 pagos confirmados")).toBeInTheDocument();
  });
});

describe("TransactionRow", () => {
  it("un pendiente no usa el check de pagado y abre el detalle", () => {
    render(
      <ul>
        <TransactionRow movement={pending} from="ventas" />
      </ul>,
    );

    expect(screen.getByText("Esperando pago")).toBeInTheDocument();
    expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/ventas/${pending.id}?desde=ventas`,
    );
  });

  it("desde Inicio, un cobro vigente abre el estatus y uno pagado el detalle", () => {
    const waiting = render(
      <ul>
        <TransactionRow movement={pending} from="inicio" />
      </ul>,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/cobro/${pending.id}`,
    );
    waiting.unmount();

    const creating = render(
      <ul>
        <TransactionRow
          movement={{ ...pending, status: "created" }}
          from="inicio"
        />
      </ul>,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/cobro/${pending.id}`,
    );
    creating.unmount();

    render(
      <ul>
        <TransactionRow
          movement={{ ...pending, status: "paid" }}
          from="inicio"
        />
      </ul>,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/ventas/${pending.id}?desde=inicio`,
    );
  });
});

describe("MovementStatusFilter", () => {
  it("marca el estado elegido y Todos no lleva parámetro", () => {
    render(<MovementStatusFilter status="qr_uncertain" />);

    expect(screen.getByRole("link", { name: "Sin confirmar" })).toHaveAttribute(
      "href",
      "/ventas?estado=qr_uncertain",
    );
    expect(screen.getByRole("link", { name: "Sin confirmar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Todos" })).toHaveAttribute(
      "href",
      "/ventas",
    );
    expect(screen.getByRole("link", { name: "Todos" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Pagado" })).toHaveAttribute(
      "href",
      "/ventas?estado=paid",
    );
  });
});

describe("MovementHistory", () => {
  it("un filtro vacío no dice que no hay movimientos", () => {
    render(
      <MovementHistory
        variant="history"
        from="ventas"
        status="expired"
        initial={[]}
        nextCursor={null}
      />,
    );

    expect(
      screen.getByText("No hay cobros en este estado"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Aún no tienes movimientos"),
    ).not.toBeInTheDocument();
  });

  it("cargar más conserva el filtro", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ movements: [], nextCursor: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MovementHistory
        variant="history"
        from="ventas"
        status="paid"
        initial={[pending]}
        nextCursor="cursor-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Cargar movimientos anteriores" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sales?cursor=cursor-1&estado=paid",
      { cache: "no-store" },
    );
    vi.unstubAllGlobals();
  });
});
