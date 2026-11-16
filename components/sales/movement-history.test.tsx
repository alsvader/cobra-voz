import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MovementHistory } from "@/components/sales/movement-history";
import type { MovementDto } from "@/modules/sales/types";

function movement(id: string, amountCents: number): MovementDto {
  return {
    id,
    reference: `CV-${id.slice(0, 8).toUpperCase()}`,
    status: "paid",
    amountCents,
    occurredAt: "2026-11-16T18:00:00.000Z",
    occurredLabel: "16 nov, 12:00",
  };
}

describe("MovementHistory", () => {
  it("muestra un cobro nuevo cuando el servidor manda otra lista", () => {
    const older = movement("11111111-0000-4000-8000-000000000001", 15_000);
    const paid = movement("22222222-0000-4000-8000-000000000002", 1_000);
    const { rerender } = render(
      <MovementHistory
        variant="recent"
        from="inicio"
        initial={[older]}
        nextCursor={null}
      />,
    );
    expect(screen.getByText("$150.00")).toBeInTheDocument();
    expect(screen.queryByText("$10.00")).not.toBeInTheDocument();

    rerender(
      <MovementHistory
        variant="recent"
        from="inicio"
        initial={[paid, older]}
        nextCursor={null}
      />,
    );

    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$150.00")).toBeInTheDocument();
  });
});
