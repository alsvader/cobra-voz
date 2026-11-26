import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingChargeNotice } from "@/components/charge/pending-charge-notice";
import type { ChargeDto } from "@/modules/charges/types";

const charge: ChargeDto = {
  id: "3f2b8c1e-0000-4000-8000-000000000001",
  reference: "CV-3F2B8C1E",
  amountCents: 15050,
  currency: "MXN",
  status: "waiting_payment",
  collectionMethod: "qr",
  phoneLast4: null,
  createdAt: "2026-11-15T12:00:00.000Z",
  expiresAt: "2026-11-15T12:10:00.000Z",
  closedAt: null,
  qr: {
    payload: "COBRAVOZ-MOCK|x",
    expiresAt: "2026-11-15T12:10:00.000Z",
    simulated: true,
  },
};

describe("PendingChargeNotice", () => {
  it("ofrece retomar un cobro en curso, sin anunciarlo como pagado", () => {
    render(<PendingChargeNotice charge={charge} />);

    expect(screen.getByText("Cobro pendiente")).toBeInTheDocument();
    expect(screen.getByText(/cobro en curso de \$150\.50/)).toBeInTheDocument();
    expect(screen.queryByText(/pago recibido/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retomar cobro" })).toHaveAttribute(
      "href",
      `/cobro/${charge.id}`,
    );
  });
});
