import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AmountConfirmation } from "@/components/charge/amount-confirmation";
import { AmountDisplay } from "@/components/charge/amount-display";
import { VoiceCaptureButton } from "@/components/charge/voice-capture-button";

function setup(
  props: Partial<React.ComponentProps<typeof AmountConfirmation>> = {},
) {
  const onConfirm = vi.fn(async () => ({ status: "accepted" as const }));
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(
    <AmountConfirmation
      initialCents={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel, user };
}

const confirmButton = () =>
  screen.getByRole("button", {
    name: /confirm(ar importe|ando|ado)|importe confirmado|generando código/i,
  });

describe("AmountDisplay", () => {
  it("muestra el importe con símbolo, miles y dos decimales", () => {
    render(<AmountDisplay cents={150025} label="Importe a cobrar" />);
    expect(screen.getByText("$1,500.25")).toBeInTheDocument();
    expect(screen.getByText("1,500 pesos con 25 centavos")).toBeInTheDocument();
  });

  it("sin importe válido muestra un guion, nunca $0.00", () => {
    render(<AmountDisplay cents={null} label="Importe a cobrar" />);
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.getByText("Sin importe")).toBeInTheDocument();
  });

  it("muestra la transcripción solo cuando existe", () => {
    const { rerender } = render(
      <AmountDisplay cents={15000} label="Importe a cobrar" />,
    );
    expect(screen.queryByText(/Escuchamos/)).not.toBeInTheDocument();

    rerender(
      <AmountDisplay
        cents={15000}
        label="Importe a cobrar"
        transcript="ciento cincuenta pesos"
      />,
    );
    expect(screen.getByText(/ciento cincuenta pesos/)).toBeInTheDocument();
  });
});

describe("VoiceCaptureButton", () => {
  it("inactivo: etiqueta «Hablar para cobrar» y botón habilitado", () => {
    render(<VoiceCaptureButton state="idle" />);
    expect(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    ).toBeEnabled();
  });

  it("escuchando: lo indica con texto y aria-pressed", () => {
    render(<VoiceCaptureButton state="listening" />);
    const button = screen.getByRole("button", { name: "Escuchando…" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("procesando: texto de progreso y sin segunda grabación", () => {
    render(<VoiceCaptureButton state="processing" />);
    const button = screen.getByRole("button", {
      name: "Reconociendo importe…",
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("no disponible: inhabilitado", () => {
    render(<VoiceCaptureButton state="unavailable" />);
    expect(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    ).toBeDisabled();
  });
});

describe("AmountConfirmation — captura manual desde cero", () => {
  it("abre con el campo enfocado y el CTA deshabilitado", () => {
    setup();
    expect(screen.getByLabelText(/Importe a cobrar \(MXN\)/)).toHaveFocus();
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText("Sin importe")).toBeInTheDocument();
  });

  it("la cifra grande se actualiza al escribir y NO confirma por sí sola", async () => {
    const { onConfirm, user } = setup();
    await user.type(screen.getByLabelText(/Importe a cobrar \(MXN\)/), "150.5");

    expect(screen.getByText("$150.50")).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirma con centavos exactos solo al pulsar «Confirmar importe»", async () => {
    const { onConfirm, user } = setup();
    await user.type(screen.getByLabelText(/Importe a cobrar \(MXN\)/), "0.29");
    await user.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(29);
  });

  it("Enter en el campo equivale al CTA explícito", async () => {
    const { onConfirm, user } = setup();
    await user.type(
      screen.getByLabelText(/Importe a cobrar \(MXN\)/),
      "80{Enter}",
    );
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(8000);
  });

  it.each([
    ["10.123", /máximo dos decimales/i],
    ["0", /mayor que \$0\.00/i],
    ["abc", /solo números/i],
    ["150,50", /usa punto/i],
    ["9999999", /demasiado alto/i],
  ])("«%s» muestra el error y bloquea el CTA", async (typed, message) => {
    const { onConfirm, user } = setup();
    await user.type(screen.getByLabelText(/Importe a cobrar \(MXN\)/), typed);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText(/Importe a cobrar \(MXN\)/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(confirmButton()).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("no muestra error por campo vacío (evita desplazar los botones al tocar Cancelar)", async () => {
    const { onCancel, user } = setup();
    await user.click(screen.getByLabelText(/Importe a cobrar \(MXN\)/));
    await user.tab();

    expect(screen.queryByText(/Escribe el importe/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Cancelar vuelve sin confirmar nada", async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("AmountConfirmation — importe precargado", () => {
  it("muestra el importe y exige confirmar (no se confirma solo)", () => {
    const { onConfirm } = setup({ initialCents: 15050 });
    expect(screen.getByText("$150.50")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Importe a cobrar \(MXN\)/),
    ).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("muestra la transcripción cuando viene de voz", () => {
    setup({ initialCents: 15000, transcript: "ciento cincuenta pesos" });
    expect(screen.getByText(/ciento cincuenta pesos/)).toBeInTheDocument();
  });

  it("«Corregir importe» abre el campo con el valor actual y pide confirmar de nuevo", async () => {
    const { onConfirm, user } = setup({ initialCents: 15050 });
    await user.click(screen.getByRole("button", { name: "Corregir importe" }));

    const field = screen.getByLabelText(/Importe a cobrar \(MXN\)/);
    expect(field).toHaveValue("150.50");
    expect(onConfirm).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, "200");
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(20000);
  });

  it("al corregir, un valor inválido bloquea la confirmación", async () => {
    const { onConfirm, user } = setup({ initialCents: 15050 });
    await user.click(screen.getByRole("button", { name: "Corregir importe" }));
    await user.clear(screen.getByLabelText(/Importe a cobrar \(MXN\)/));
    await user.type(screen.getByLabelText(/Importe a cobrar \(MXN\)/), "1.234");

    expect(confirmButton()).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("«Volver a hablar» solo aparece si la voz está disponible", async () => {
    const { user } = setup({ initialCents: 15000 });
    expect(
      screen.queryByRole("button", { name: "Volver a hablar" }),
    ).not.toBeInTheDocument();

    const onRetryVoice = vi.fn();
    render(
      <AmountConfirmation
        initialCents={15000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRetryVoice={onRetryVoice}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Volver a hablar" }));
    expect(onRetryVoice).toHaveBeenCalledTimes(1);
  });
});

describe("AmountConfirmation — protección contra duplicados", () => {
  it("clics repetidos confirman una sola vez y bloquean los controles", async () => {
    let resolve!: (value: { status: "accepted" }) => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<{ status: "accepted" }>((r) => {
          resolve = r;
        }),
    );
    const { user } = setup({ initialCents: 15000, onConfirm });

    const button = confirmButton();
    await user.click(button);
    await user.click(button);
    await user.dblClick(button);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Generando código…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Corregir importe" }),
    ).toBeDisabled();

    resolve({ status: "accepted" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Importe confirmado" }),
      ).toBeDisabled(),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("si la confirmación falla, explica el problema y permite reintentar", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValueOnce({ status: "error", message: "Sin conexión." })
      .mockResolvedValueOnce({ status: "accepted" });
    const { user } = setup({ initialCents: 15000, onConfirm });

    await user.click(confirmButton());
    expect(await screen.findByText("Sin conexión.")).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();

    await user.click(confirmButton());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Sin conexión.")).not.toBeInTheDocument();
  });

  it("si la confirmación lanza un error, no queda bloqueada", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    const { user } = setup({ initialCents: 15000, onConfirm });

    await user.click(confirmButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /No pudimos continuar/,
    );
    expect(confirmButton()).toBeEnabled();
  });
});
