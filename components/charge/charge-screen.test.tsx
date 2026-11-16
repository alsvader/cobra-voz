import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { announceVerifiedPayment } from "@/adapters/speech/announce";
import { ChargeScreen } from "@/components/charge/charge-screen";
import { ChargeView, formatRemaining } from "@/components/charge/charge-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ChargeDto, ChargeStatus } from "@/modules/charges/types";

const replace = vi.fn();
// Como el router real de Next: la MISMA instancia en cada render.
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/adapters/speech/announce", () => ({
  announceVerifiedPayment: vi.fn(),
}));

const T0 = Date.parse("2026-11-15T12:00:00Z");
const ID = "3f2b8c1e-0000-4000-8000-000000000001";

function chargeWith(
  status: ChargeStatus,
  overrides: Partial<ChargeDto> = {},
): ChargeDto {
  const waiting = status === "waiting_payment";
  return {
    id: ID,
    reference: "CV-3F2B8C1E",
    amountCents: 15050,
    currency: "MXN",
    status,
    createdAt: new Date(T0).toISOString(),
    expiresAt: waiting ? new Date(T0 + 600_000).toISOString() : null,
    closedAt: null,
    qr: waiting
      ? {
          payload: `COBRAVOZ-MOCK|${ID}|15050|1234567`,
          expiresAt: new Date(T0 + 600_000).toISOString(),
          simulated: true,
        }
      : null,
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Respuesta del backend para un estado dado, con la hora actual del servidor. */
const serverSays = (charge: ChargeDto, status = 200) =>
  json({ charge, serverTime: new Date(Date.now()).toISOString() }, status);

describe("ChargeView — variantes por estado persistido", () => {
  function view(charge: ChargeDto, remainingMs: number | null = null) {
    return render(
      <ChargeView
        charge={charge}
        remainingMs={remainingMs}
        connection="ok"
        refreshing={false}
        closeError={null}
        onRefresh={vi.fn()}
        onRequestClose={vi.fn()}
      />,
    );
  }

  it("generando QR: sin código (ni ficticio), sin acciones de cobro", () => {
    view(chargeWith("created"));

    expect(screen.getByText("Generando QR")).toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("esperando pago: QR rotulado de prueba, importe, referencia y tiempo restante", () => {
    view(chargeWith("waiting_payment"), 125_000);

    expect(screen.getByText("Esperando pago")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /código qr de codi para cobrar \$150\.50/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/QR de prueba/)).toBeInTheDocument();
    expect(screen.getByText("$150.50")).toBeInTheDocument();
    expect(screen.getByText("CV-3F2B8C1E")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(
      "Tiempo restante 02:05",
    );
    expect(
      screen.getByRole("button", { name: "Consultar nuevamente" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cerrar cobro" })).toBeEnabled();
  });

  it("un QR real (no simulado) no lleva el rótulo de prueba", () => {
    const base = chargeWith("waiting_payment");
    view({ ...base, qr: { ...base.qr!, simulated: false } }, 60_000);

    expect(screen.queryByText(/QR de prueba/)).not.toBeInTheDocument();
    expect(screen.getByTestId("codi-qr")).toBeInTheDocument();
  });

  it("nunca dice «Pago recibido» mientras el cobro está pendiente", () => {
    view(chargeWith("waiting_payment"), 60_000);

    expect(screen.queryByText(/pago recibido/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/solo marcaremos «Pagado» cuando el banco lo confirme/i),
    ).toBeInTheDocument();
  });

  it("pagado: éxito con importe y referencia, sin QR; acción «Nuevo cobro»", () => {
    view(chargeWith("paid"));

    expect(screen.getByText("¡Pago recibido!")).toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nuevo cobro" })).toHaveAttribute(
      "href",
      "/inicio",
    );
    expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      `/ventas/${ID}?desde=cobro`,
    );
  });

  it("expirado: no es un rechazo, aclara el posible pago tardío y no muestra QR", () => {
    view(chargeWith("expired"));

    expect(screen.getByText("Cobro expirado")).toBeInTheDocument();
    expect(
      screen.getByText(/no significa que el pago se haya rechazado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/puede confirmarlo más tarde/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nuevo cobro" }),
    ).toBeInTheDocument();
  });

  it("cerrado localmente: aclara que no cancela el pago bancario", () => {
    view(
      chargeWith("locally_closed", { closedAt: new Date(T0).toISOString() }),
    );

    expect(screen.getByText("Cobro cerrado")).toBeInTheDocument();
    expect(
      screen.getByText(
        /solo se cerró en cobravoz; no cancela un pago en el banco/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a Inicio" }),
    ).toBeInTheDocument();
  });

  it("QR incierto: lo dice sin atribuir resultado, sin QR y sin reintento", () => {
    view(chargeWith("qr_uncertain"));

    expect(screen.getByText("No pudimos confirmar el QR")).toBeInTheDocument();
    expect(
      screen.getByText(/no repetiremos la solicitud/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("incidencia: sin éxito ni QR", () => {
    view(chargeWith("incident"));

    expect(screen.getByText("Incidencia")).toBeInTheDocument();
    expect(screen.queryByText(/pago recibido/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
  });

  it("esperando pago sin QR registrado no inventa uno", () => {
    view({ ...chargeWith("waiting_payment"), qr: null }, 60_000);

    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    expect(
      screen.getByText(/no encontramos el código de este cobro/i),
    ).toBeInTheDocument();
  });

  it("a tiempo cero espera la confirmación del servidor en lugar de declarar vencido", () => {
    view(chargeWith("waiting_payment"), 0);

    expect(screen.getByText("Esperando pago")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(
      "Verificando el vencimiento…",
    );
    expect(screen.queryByText("Cobro expirado")).not.toBeInTheDocument();
  });

  it("formatea el tiempo restante como mm:ss (redondeando hacia arriba)", () => {
    expect(formatRemaining(600_000)).toBe("10:00");
    expect(formatRemaining(59_001)).toBe("01:00");
    expect(formatRemaining(1)).toBe("00:01");
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-5)).toBe("00:00");
  });
});

describe("ChargeScreen — sincronización con el backend", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
        "performance",
      ],
    });
    vi.setSystemTime(T0);
    // Testing Library solo reconoce relojes simulados de Jest; con esto también
    // drena los temporizadores de Vitest y `userEvent` no se queda esperando.
    (globalThis as { jest?: unknown }).jest = {
      advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
    };
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    replace.mockClear();
    vi.mocked(announceVerifiedPayment).mockClear();
  });

  afterEach(() => {
    delete (globalThis as { jest?: unknown }).jest;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const user = () => userEvent.setup({ delay: null });

  function renderWaiting() {
    return render(
      <ChargeScreen
        initialCharge={chargeWith("waiting_payment")}
        serverTime={T0}
      />,
    );
  }
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  const flush = () => advance(0);

  it("muestra el QR y descuenta el tiempo con el reloj, anclado a la hora del servidor", async () => {
    fetchMock.mockImplementation(async () =>
      serverSays(chargeWith("waiting_payment")),
    );
    renderWaiting();
    expect(screen.getByRole("timer")).toHaveTextContent("10:00");

    await advance(3_000);

    expect(screen.getByRole("timer")).toHaveTextContent("09:57");
  });

  it("«Consultar nuevamente» lee el estado persistido y refleja un pago confirmado", async () => {
    fetchMock.mockResolvedValue(serverSays(chargeWith("paid")));
    renderWaiting();
    expect(screen.queryByText("¡Pago recibido!")).not.toBeInTheDocument();

    await user().click(
      screen.getByRole("button", { name: "Consultar nuevamente" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/charges/${ID}/reconcile`,
      expect.objectContaining({ method: "POST" }),
    );
    await flush();
    expect(screen.getByText("¡Pago recibido!")).toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    expect(announceVerifiedPayment).toHaveBeenCalledTimes(1);
    expect(announceVerifiedPayment).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, status: "paid", amountCents: 15050 }),
    );
  });

  it("consulta periódicamente mientras espera y se detiene al llegar a un estado final", async () => {
    fetchMock
      .mockResolvedValueOnce(serverSays(chargeWith("waiting_payment")))
      .mockResolvedValue(serverSays(chargeWith("paid")));
    renderWaiting();

    await advance(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("¡Pago recibido!")).toBeInTheDocument();
    expect(announceVerifiedPayment).toHaveBeenCalledTimes(1);

    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(announceVerifiedPayment).toHaveBeenCalledTimes(1);
  });

  it("no consulta mientras la pestaña está oculta", async () => {
    fetchMock.mockImplementation(async () =>
      serverSays(chargeWith("waiting_payment")),
    );
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    renderWaiting();

    await advance(30_000);
    expect(fetchMock).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    await advance(5_000);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("si la consulta falla: «Verificación no disponible», el QR sigue y no se declara rechazo", async () => {
    fetchMock.mockRejectedValue(new TypeError("sin red"));
    renderWaiting();

    await user().click(
      screen.getByRole("button", { name: "Consultar nuevamente" }),
    );

    await flush();
    expect(screen.getByText("Verificación no disponible")).toBeInTheDocument();
    expect(
      screen.getByText(/no significa que el pago haya fallado/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("codi-qr")).toBeInTheDocument();
    expect(screen.getByText("Esperando pago")).toBeInTheDocument();
    expect(screen.queryByText("Cobro expirado")).not.toBeInTheDocument();
  });

  it("al agotarse el tiempo NO decide el vencimiento: espera lo que diga el servidor", async () => {
    let serverStatus: ChargeStatus = "waiting_payment";
    fetchMock.mockImplementation(async () =>
      serverSays(
        serverStatus === "waiting_payment"
          ? chargeWith("waiting_payment")
          : chargeWith("expired"),
      ),
    );
    // Faltan 10 s para el vencimiento.
    vi.setSystemTime(T0 + 590_000);
    render(
      <ChargeScreen
        initialCharge={chargeWith("waiting_payment")}
        serverTime={T0 + 590_000}
      />,
    );

    await advance(10_000);
    // El tiempo llegó a cero, pero el servidor todavía dice «esperando».
    expect(screen.getByRole("timer")).toHaveTextContent(
      "Verificando el vencimiento…",
    );
    expect(screen.getByText("Esperando pago")).toBeInTheDocument();
    expect(screen.queryByText("Cobro expirado")).not.toBeInTheDocument();

    serverStatus = "expired";
    await advance(10_000);
    expect(screen.getByText("Cobro expirado")).toBeInTheDocument();
    expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
  });

  it("con la sesión vencida envía a A01 volviendo a este cobro", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "unauthenticated" } }, 401),
    );
    renderWaiting();

    await user().click(
      screen.getByRole("button", { name: "Consultar nuevamente" }),
    );

    await flush();
    expect(replace).toHaveBeenCalledTimes(1);
    const target = String(replace.mock.calls[0][0]);
    expect(target).toContain("/acceso");
    expect(target).toContain(encodeURIComponent(`/cobro/${ID}`));
    expect(target).toContain("sesion-expirada");
  });

  describe("Cerrar cobro", () => {
    it("pide confirmación y advierte que NO cancela el pago bancario", async () => {
      renderWaiting();

      await user().click(screen.getByRole("button", { name: "Cerrar cobro" }));

      const dialog = screen.getByRole("alertdialog");
      expect(
        within(dialog).getByText("¿Cerrar este cobro?"),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          "Se cerrará en CobraVoz, pero esto no cancela un pago en el banco.",
        ),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("«Volver» descarta el cierre sin llamar al servidor", async () => {
      renderWaiting();
      const u = user();
      await u.click(screen.getByRole("button", { name: "Cerrar cobro" }));

      await u.click(screen.getByRole("button", { name: "Volver" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByText("Esperando pago")).toBeInTheDocument();
    });

    it("confirmar cierra el cobro SOLO con la respuesta del servidor", async () => {
      fetchMock.mockResolvedValue(
        serverSays(
          chargeWith("locally_closed", {
            closedAt: new Date(T0).toISOString(),
          }),
        ),
      );
      renderWaiting();
      const u = user();
      await u.click(screen.getByRole("button", { name: "Cerrar cobro" }));

      await u.click(screen.getByRole("button", { name: "Sí, cerrar cobro" }));

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/charges/${ID}/close`,
        expect.objectContaining({ method: "POST" }),
      );
      await flush();
      expect(screen.getByText("Cobro cerrado")).toBeInTheDocument();
      expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("si el cobro ya se pagó, gana el pago y se muestra como pagado", async () => {
      fetchMock.mockResolvedValue(serverSays(chargeWith("paid"), 409));
      renderWaiting();
      const u = user();
      await u.click(screen.getByRole("button", { name: "Cerrar cobro" }));

      await u.click(screen.getByRole("button", { name: "Sí, cerrar cobro" }));

      await flush();
      expect(screen.getByText("¡Pago recibido!")).toBeInTheDocument();
      expect(screen.queryByText("Cobro cerrado")).not.toBeInTheDocument();
      expect(announceVerifiedPayment).toHaveBeenCalledTimes(1);
    });

    it("si falla la red no se cierra nada y se explica", async () => {
      fetchMock.mockRejectedValue(new TypeError("sin red"));
      renderWaiting();
      const u = user();
      await u.click(screen.getByRole("button", { name: "Cerrar cobro" }));

      await u.click(screen.getByRole("button", { name: "Sí, cerrar cobro" }));

      await flush();
      expect(screen.getByText("No se cerró el cobro")).toBeInTheDocument();
      expect(screen.getByText("Esperando pago")).toBeInTheDocument();
      expect(screen.getByTestId("codi-qr")).toBeInTheDocument();
    });

    it("una consulta que estaba en vuelo no revierte un cierre ya confirmado", async () => {
      let releaseStale!: (value: Response) => void;
      fetchMock
        .mockImplementationOnce(
          () => new Promise<Response>((resolve) => (releaseStale = resolve)),
        )
        .mockResolvedValue(
          serverSays(
            chargeWith("locally_closed", {
              closedAt: new Date(T0).toISOString(),
            }),
          ),
        );
      renderWaiting();
      const u = user();

      // Consulta lenta aún sin responder…
      await u.click(
        screen.getByRole("button", { name: "Consultar nuevamente" }),
      );
      await u.click(screen.getByRole("button", { name: "Cerrar cobro" }));
      await u.click(screen.getByRole("button", { name: "Sí, cerrar cobro" }));
      await flush();
      expect(screen.getByText("Cobro cerrado")).toBeInTheDocument();

      // …y responde tarde con el estado anterior.
      await act(async () =>
        releaseStale(serverSays(chargeWith("waiting_payment"))),
      );

      expect(screen.getByText("Cobro cerrado")).toBeInTheDocument();
      expect(screen.queryByTestId("codi-qr")).not.toBeInTheDocument();
    });
  });

  it("no anuncia un cobro que ya estaba pagado al abrir la pantalla", () => {
    render(<ChargeScreen initialCharge={chargeWith("paid")} serverTime={T0} />);
    expect(announceVerifiedPayment).not.toHaveBeenCalled();
  });

  it("no anuncia el pago que aparece al volver a la pestaña", async () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fetchMock.mockResolvedValue(serverSays(chargeWith("paid")));
    renderWaiting();

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();

    expect(screen.getByText("¡Pago recibido!")).toBeInTheDocument();
    expect(announceVerifiedPayment).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it("no anuncia si «Consultar nuevamente» se pidió con la pestaña oculta", async () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fetchMock.mockResolvedValue(serverSays(chargeWith("paid")));
    renderWaiting();

    await user().click(
      screen.getByRole("button", { name: "Consultar nuevamente" }),
    );
    await flush();

    expect(screen.getByText("¡Pago recibido!")).toBeInTheDocument();
    expect(announceVerifiedPayment).not.toHaveBeenCalled();
    hidden.mockRestore();
  });
});

describe("ConfirmDialog", () => {
  function setup(
    props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
  ) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="¿Seguro?"
        description="Descripción"
        confirmLabel="Sí"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />,
    );
    return { onConfirm, onCancel };
  }

  it("se abre como modal con título y descripción asociados", () => {
    setup();
    const dialog = screen.getByRole("alertdialog", { name: "¿Seguro?" });
    expect(dialog).toHaveAccessibleDescription("Descripción");
    expect(dialog).toHaveAttribute("open");
  });

  it("Escape cancela (no confirma)", async () => {
    const { onConfirm, onCancel } = setup();
    const dialog = screen.getByRole("alertdialog");

    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ocupado: bloquea botones y Escape", () => {
    const { onCancel } = setup({ busy: true });
    expect(screen.getByRole("button", { name: "Sí" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No" })).toBeDisabled();

    screen
      .getByRole("alertdialog")
      .dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
