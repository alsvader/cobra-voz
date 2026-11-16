import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailySummary } from "@/components/sales/daily-summary";
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
});
