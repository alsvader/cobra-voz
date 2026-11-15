import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";

describe("Button", () => {
  it("es type=button por defecto (no envía formularios por accidente)", () => {
    render(<Button>Confirmar importe</Button>);
    expect(
      screen.getByRole("button", { name: "Confirmar importe" }),
    ).toHaveAttribute("type", "button");
  });

  it("el CTA principal es de 56px y ancho completo", () => {
    render(<Button>Nuevo cobro</Button>);
    const button = screen.getByRole("button", { name: "Nuevo cobro" });
    expect(button).toHaveClass("h-14", "w-full");
  });

  it("queda inhabilitado mientras se procesa", () => {
    render(<Button disabled>Generando…</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("StatusBadge", () => {
  it("muestra siempre una etiqueta de texto además del ícono", () => {
    render(<StatusBadge tone="warning" label="Esperando pago" />);
    expect(screen.getByText("Esperando pago")).toBeInTheDocument();
  });

  it("oculta el ícono decorativo a lectores de pantalla", () => {
    const { container } = render(<StatusBadge tone="success" label="Pagado" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("Notice", () => {
  it("anuncia estados informativos como status (polite)", () => {
    render(
      <Notice tone="warning" label="Pago sin confirmar">
        Todavía no recibimos la confirmación del banco.
      </Notice>,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toHaveTextContent("Pago sin confirmar");
  });

  it("anuncia errores como alert", () => {
    render(
      <Notice tone="error" label="No se pudo generar">
        Inténtalo de nuevo.
      </Notice>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("muestra título y descripción accionables", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Aún no tienes movimientos"
        description="Cuando cobres, aparecerán aquí."
      />,
    );
    expect(screen.getByText("Aún no tienes movimientos")).toBeInTheDocument();
    expect(
      screen.getByText("Cuando cobres, aparecerán aquí."),
    ).toBeInTheDocument();
  });
});
