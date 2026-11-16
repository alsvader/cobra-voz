import { afterEach, describe, expect, it, vi } from "vitest";
import {
  announceVerifiedPayment,
  announcedStorageKey,
  paymentAnnouncement,
} from "./announce";

function storage(): Storage {
  const jar = new Map<string, string>();
  return {
    get length() {
      return jar.size;
    },
    clear: () => jar.clear(),
    getItem: (key) => jar.get(key) ?? null,
    key: (index) => [...jar.keys()][index] ?? null,
    removeItem: (key) => jar.delete(key),
    setItem: (key, value) => jar.set(key, value),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const charge = { id: "charge-1", amountCents: 15_000 };

describe("paymentAnnouncement", () => {
  it("arma la frase del pago con el importe en palabras", () => {
    expect(paymentAnnouncement(15_000)).toBe(
      "¡Pago recibido! Ciento cincuenta pesos.",
    );
    expect(paymentAnnouncement(7_550)).toBe(
      "¡Pago recibido! Setenta y cinco pesos con cincuenta centavos.",
    );
    expect(paymentAnnouncement(0)).toBeNull();
  });
});

describe("announceVerifiedPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("habla una vez si el anuncio está activo y la pestaña visible", async () => {
    const speak = vi.fn();
    const memory = storage();
    const fetchImpl = vi.fn(async () =>
      json({ voiceAnnouncementsEnabled: true }),
    );

    await announceVerifiedPayment(charge, {
      fetch: fetchImpl,
      speak,
      hidden: false,
      reducedMotion: false,
      storage: memory,
    });
    await announceVerifiedPayment(charge, {
      fetch: fetchImpl,
      speak,
      hidden: false,
      reducedMotion: false,
      storage: memory,
    });

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(
      "¡Pago recibido! Ciento cincuenta pesos.",
    );
    expect(memory.getItem(announcedStorageKey(charge.id))).toBe("1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("no habla con el interruptor apagado, la pestaña oculta o menos movimiento", async () => {
    const speak = vi.fn();
    const fetchImpl = vi.fn(async () =>
      json({ voiceAnnouncementsEnabled: false }),
    );

    await announceVerifiedPayment(charge, {
      fetch: fetchImpl,
      speak,
      hidden: false,
      reducedMotion: false,
      storage: storage(),
    });
    await announceVerifiedPayment(
      { ...charge, id: "hidden" },
      {
        fetch: vi.fn(async () => json({ voiceAnnouncementsEnabled: true })),
        speak,
        hidden: true,
        reducedMotion: false,
        storage: storage(),
      },
    );
    await announceVerifiedPayment(
      { ...charge, id: "reduced" },
      {
        fetch: vi.fn(),
        speak,
        hidden: false,
        reducedMotion: true,
        storage: storage(),
      },
    );

    expect(speak).not.toHaveBeenCalled();
  });

  it("si el dispositivo rechaza el audio, no lo vuelve a intentar", async () => {
    const speak = vi.fn(() => {
      throw new Error("blocked");
    });
    const memory = storage();
    const fetchImpl = vi.fn(async () =>
      json({ voiceAnnouncementsEnabled: true }),
    );
    const deps = {
      fetch: fetchImpl,
      speak,
      hidden: false,
      reducedMotion: false,
      storage: memory,
    };

    await expect(
      announceVerifiedPayment(charge, deps),
    ).resolves.toBeUndefined();
    await announceVerifiedPayment(charge, deps);

    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("usa SpeechSynthesis en es-MX cuando no hay hablante de prueba", async () => {
    const speak = vi.fn();
    const voice = { lang: "es-MX", name: "Paulina" };
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      getVoices: () => [voice],
      speak,
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        voice: unknown = null;
        constructor(public text: string) {}
      },
    );

    await announceVerifiedPayment(charge, {
      fetch: vi.fn(async () => json({ voiceAnnouncementsEnabled: true })),
      hidden: false,
      reducedMotion: false,
      storage: storage(),
    });

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]?.[0] as {
      text: string;
      lang: string;
      voice: unknown;
    };
    expect(utterance.text).toBe("¡Pago recibido! Ciento cincuenta pesos.");
    expect(utterance.lang).toBe("es-MX");
    expect(utterance.voice).toBe(voice);
  });
});
