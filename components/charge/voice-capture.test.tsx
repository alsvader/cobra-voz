import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmAmountScreen } from "@/components/charge/confirm-amount-screen";
import { VoiceCapture } from "@/components/charge/voice-capture";
import { VOICE_COPY } from "@/modules/voice/messages";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
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

describe("VoiceCapture", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("MediaRecorder", FakeRecorder);
  });

  it("sin clave deja el micrófono inhabilitado y la captura manual a la vista", () => {
    render(<VoiceCapture enabled={false} />);
    expect(
      screen.getByRole("button", { name: "Hablar para cobrar" }),
    ).toBeDisabled();
    expect(screen.getByText(VOICE_COPY.unavailable)).toBeInTheDocument();
  });

  it("micrófono denegado: avisa y no inventa un importe", async () => {
    mockMic(vi.fn().mockRejectedValue(new Error("denied")));
    render(<VoiceCapture enabled />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Hablar para cobrar" }));
    expect(await screen.findByText(VOICE_COPY.denied)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("un importe claro abre P02; un fallo de red no sale de Inicio", async () => {
    const getUserMedia = vi.fn(async () =>
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
    render(
      <ConfirmAmountScreen
        initialCents={15_000}
        transcript="ciento cincuenta"
      />,
    );
    expect(screen.getByText(/Escuchamos/)).toHaveTextContent("ciento cincuenta");
    fireEvent.click(screen.getByRole("button", { name: "Volver a hablar" }));
    expect(push).toHaveBeenCalledWith("/inicio");
  });
});
