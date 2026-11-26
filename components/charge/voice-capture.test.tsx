import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmAmountScreen } from "@/components/charge/confirm-amount-screen";
import { VoiceCapture } from "@/components/charge/voice-capture";
import { VOICE_COPY } from "@/modules/voice/messages";

const push = vi.fn();
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
}));

class FakeRecorder extends EventTarget {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  static isTypeSupported(type: string) {
    return type.startsWith("audio/webm");
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    const available = new Event("dataavailable");
    Object.assign(available, { data: new Blob([new Uint8Array(900)]) });
    this.dispatchEvent(available);
    this.dispatchEvent(new Event("stop"));
  }
}

function mockMic(getUserMedia: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

function installApp() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(display-mode: standalone)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: {
      query: vi.fn(async () => ({ state: "prompt" })),
    },
  });
}

describe("VoiceCapture", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  it("sin clave deja el micrófono inhabilitado y la captura manual a la vista", () => {
    render(<VoiceCapture enabled={false} />);
    expect(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    ).toBeDisabled();
    expect(screen.getByText(VOICE_COPY.unavailable)).toBeInTheDocument();
  });

  it("sin https no pide el micrófono ni lo marca bloqueado", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    const getUserMedia = vi.fn();
    mockMic(getUserMedia);
    render(<VoiceCapture enabled />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    );
    expect(await screen.findByText(VOICE_COPY.insecure)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByText(VOICE_COPY.denied)).not.toBeInTheDocument();
  });

  it("en la app instalada, cancelar desde hablar deja una sola card de reintento", async () => {
    installApp();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
      .mockResolvedValueOnce({
        getTracks: () => [{ stop: vi.fn() }],
      });
    mockMic(getUserMedia);
    render(<VoiceCapture enabled />);
    expect(
      await screen.findByRole("button", {
        name: VOICE_COPY.installAllowAction,
      }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    );

    expect(
      await screen.findByText(VOICE_COPY.installDismissed),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: VOICE_COPY.installRetryAction }),
    ).toBeInTheDocument();
    expect(screen.queryByText(VOICE_COPY.denied)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: VOICE_COPY.installAllowAction }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: VOICE_COPY.installRetryAction }),
    );
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(
        screen.queryByText(VOICE_COPY.installDismissed),
      ).not.toBeInTheDocument();
    });
  });

  it("en la app instalada, conceder desde hablar oculta el aviso", async () => {
    installApp();
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop: vi.fn() }],
    }));
    mockMic(getUserMedia);
    render(<VoiceCapture enabled />);
    expect(
      await screen.findByRole("button", {
        name: VOICE_COPY.installAllowAction,
      }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    );

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: VOICE_COPY.installAllowAction }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText(VOICE_COPY.denied)).not.toBeInTheDocument();
  });

  it("micrófono denegado: avisa y no inventa un importe", async () => {
    mockMic(vi.fn().mockRejectedValue(new Error("denied")));
    render(<VoiceCapture enabled />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    );
    expect(await screen.findByText(VOICE_COPY.denied)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("un importe claro abre P02; un fallo de red no sale de Inicio", async () => {
    const getUserMedia = vi.fn(
      async () =>
        ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
    );
    mockMic(getUserMedia);
    let respond: (value: Response) => void = () => {};
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const { unmount } = render(<VoiceCapture enabled />);
    const button = screen.getByRole("button", { name: "Hablar para cobrar" });
    fireEvent.pointerDown(button);
    expect(
      await screen.findByRole("button", { name: "Escuchando…" }),
    ).toBeEnabled();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    fireEvent.pointerUp(button);

    expect(
      await screen.findByRole("button", { name: "Reconociendo importe…" }),
    ).toBeDisabled();
    respond(
      Response.json({ transcript: "ciento cincuenta", amountCents: 15_000 }),
    );
    await vi.waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/cobro/confirmar?centavos=15000&frase=ciento+cincuenta",
      );
    });
    expect(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    ).toBeEnabled();

    unmount();
    push.mockClear();
    fetchImpl.mockRejectedValueOnce(new Error("offline"));
    render(<VoiceCapture enabled />);
    const again = screen.getByRole("button", { name: "Hablar para cobrar" });
    fireEvent.pointerDown(again);
    await screen.findByRole("button", { name: "Escuchando…" });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    fireEvent.pointerUp(again);
    expect(await screen.findByText(VOICE_COPY.network)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("P02 con frase de voz", () => {
  it("muestra lo escuchado y volver a hablar regresa a Inicio", () => {
    search.value = "centavos=15000&frase=ciento+cincuenta";
    render(<ConfirmAmountScreen />);
    expect(screen.getByText(/Escuchamos/)).toHaveTextContent(
      "ciento cincuenta",
    );
    fireEvent.click(screen.getByRole("button", { name: "Volver a hablar" }));
    expect(push).toHaveBeenCalledWith("/inicio");
  });

  it("al quitar centavos de la URL, el importe anterior desaparece", () => {
    search.value = "centavos=1302";
    const view = render(<ConfirmAmountScreen />);
    expect(screen.getByText("$13.02")).toBeInTheDocument();

    search.value = "";
    view.rerender(<ConfirmAmountScreen />);

    expect(screen.queryByText("$13.02")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Importe a cobrar \(MXN\)/)).toHaveValue("");
  });
});
