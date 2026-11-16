import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeechTranscriber } from "@/adapters/speech/transcribe";
import { MAX_AUDIO_BYTES, interpretVoice, resetVoiceSlots } from "./service";

const merchantId = "merchant-1";

function audio(bytes = 900): Uint8Array {
  return new Uint8Array(bytes);
}

function transcriber(text: string): SpeechTranscriber {
  return { transcribe: vi.fn(async () => ({ ok: true as const, text })) };
}

async function interpret(
  overrides: Partial<Parameters<typeof interpretVoice>[0]> = {},
) {
  return interpretVoice({
    merchantId,
    bytes: audio(),
    mimeType: "audio/webm",
    durationMs: 2_000,
    transcriber: transcriber("ciento cincuenta"),
    now: 1_000,
    ...overrides,
  });
}

describe("interpretVoice", () => {
  beforeEach(() => resetVoiceSlots());

  it("devuelve el importe cuando la frase es clara", async () => {
    const speaker = transcriber("ciento cincuenta pesos");
    const result = await interpret({ transcriber: speaker });
    expect(result).toEqual({
      ok: true,
      transcript: "ciento cincuenta pesos",
      amountCents: 15_000,
    });
    expect(speaker.transcribe).toHaveBeenCalledOnce();
  });

  it("rechaza audio inválido, demasiado largo y texto ambiguo sin inventar un importe", async () => {
    expect(
      await interpret({ mimeType: "text/plain", transcriber: transcriber("150") }),
    ).toEqual({ ok: false, error: "invalid_audio" });
    expect(await interpret({ bytes: audio(100) })).toEqual({
      ok: false,
      error: "invalid_audio",
    });
    expect(await interpret({ durationMs: 20_000 })).toEqual({
      ok: false,
      error: "too_long",
    });
    const speaker = transcriber("150 o 200");
    expect(await interpret({ transcriber: speaker, now: 2_000 })).toEqual({
      ok: false,
      error: "ambiguous",
    });
  });

  it("si la transcripción falla, no hay importe", async () => {
    const result = await interpret({
      transcriber: { transcribe: async () => ({ ok: false, reason: "failed" }) },
      now: 3_000,
    });
    expect(result).toEqual({ ok: false, error: "unavailable" });
  });

  it("limita las peticiones del mismo comercio", async () => {
    for (let i = 0; i < 8; i += 1) {
      const result = await interpret({ now: 10_000 + i });
      expect(result.ok).toBe(true);
    }
    expect(await interpret({ now: 10_100 })).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("rechaza un audio más grande que el tope", async () => {
    expect(await interpret({ bytes: audio(MAX_AUDIO_BYTES + 1), now: 20_000 })).toEqual({
      ok: false,
      error: "too_large",
    });
  });
});
