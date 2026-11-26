import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnconfirmedChargesNotice } from "@/components/charge/unconfirmed-charges-notice";

describe("UnconfirmedChargesNotice", () => {
  it("abre Ventas filtrada y no elige un cobro", () => {
    render(<UnconfirmedChargesNotice />);

    expect(screen.getByText("Cobros sin confirmar")).toBeInTheDocument();
    expect(
      screen.getByText("Hay cobros de los que no sabemos si se crearon."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/CV-/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver en Ventas" })).toHaveAttribute(
      "href",
      "/ventas?estado=qr_uncertain",
    );
  });
});
