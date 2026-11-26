import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MicrophonePrimer } from "@/components/charge/microphone-primer";
import { VOICE_COPY } from "@/modules/voice/messages";

function install(options: {
  installed: boolean;
  standalone?: boolean;
  secure?: boolean;
  permission: "granted" | "denied" | "prompt" | "unknown";
  getUserMedia?: ReturnType<typeof vi.fn>;
}) {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: options.secure !== false,
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: options.installed && query === "(display-mode: standalone)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
  Object.defineProperty(navigator, "standalone", {
    configurable: true,
    value: options.standalone === true,
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: {
      query: vi.fn(async () => {
        if (options.permission === "unknown") throw new Error("unsupported");
        return { state: options.permission };
      }),
    },
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: options.getUserMedia ?? vi.fn() },
  });
}

describe("MicrophonePrimer", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("en el navegador no pide el micrófono al entrar", async () => {
    install({ installed: false, permission: "prompt" });
    render(<MicrophonePrimer />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(navigator.permissions.query).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: VOICE_COPY.installAllowAction }),
    ).not.toBeInTheDocument();
  });

  it("en la app instalada el botón pide el permiso y no graba", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop }],
    }));
    const Recorder = vi.fn();
    vi.stubGlobal("MediaRecorder", Recorder);
    install({ installed: true, permission: "prompt", getUserMedia });
    render(<MicrophonePrimer />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: VOICE_COPY.installAllowAction,
      }),
    );

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    expect(stop).toHaveBeenCalledOnce();
    expect(Recorder).not.toHaveBeenCalled();
    expect(screen.queryByText(VOICE_COPY.installAllow)).not.toBeInTheDocument();
  });

  it("si el permiso ya está concedido, no muestra el aviso", async () => {
    install({ installed: true, permission: "granted" });
    render(<MicrophonePrimer />);
    await waitFor(() => {
      expect(navigator.permissions.query).toHaveBeenCalled();
    });
    expect(screen.queryByText(VOICE_COPY.installAllow)).not.toBeInTheDocument();
  });

  it("si el permiso está bloqueado, explica y no lo vuelve a pedir", async () => {
    const getUserMedia = vi.fn();
    install({ installed: true, permission: "denied", getUserMedia });
    render(<MicrophonePrimer />);
    expect(await screen.findByText(VOICE_COPY.denied)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: VOICE_COPY.installAllowAction }),
    ).not.toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("si rechazan el diálogo, ofrece reintentar y un segundo permiso oculta el aviso", async () => {
    const stop = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
      .mockResolvedValueOnce({ getTracks: () => [{ stop }] });
    const Recorder = vi.fn();
    vi.stubGlobal("MediaRecorder", Recorder);
    install({ installed: true, permission: "prompt", getUserMedia });
    render(<MicrophonePrimer />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: VOICE_COPY.installAllowAction,
      }),
    );

    expect(
      await screen.findByText(VOICE_COPY.installDismissed),
    ).toBeInTheDocument();
    expect(screen.queryByText(VOICE_COPY.denied)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: VOICE_COPY.installRetryAction }),
    );

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(stop).toHaveBeenCalledOnce();
    expect(Recorder).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByText(VOICE_COPY.installDismissed),
      ).not.toBeInTheDocument();
    });
  });

  it("si el sistema no dice el estado, igual ofrece el botón", async () => {
    install({ installed: true, permission: "unknown" });
    render(<MicrophonePrimer />);
    expect(
      await screen.findByRole("button", {
        name: VOICE_COPY.installAllowAction,
      }),
    ).toBeEnabled();
  });

  it("en una dirección sin https no pide el micrófono ni lo marca bloqueado", async () => {
    const getUserMedia = vi.fn();
    install({
      installed: true,
      secure: false,
      permission: "prompt",
      getUserMedia,
    });
    render(<MicrophonePrimer />);
    expect(await screen.findByText(VOICE_COPY.insecure)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: VOICE_COPY.installAllowAction }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(VOICE_COPY.denied)).not.toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("en iPhone instalado también ofrece el botón", async () => {
    install({ installed: false, standalone: true, permission: "prompt" });
    render(<MicrophonePrimer />);
    expect(
      await screen.findByRole("button", {
        name: VOICE_COPY.installAllowAction,
      }),
    ).toBeEnabled();
  });
});
