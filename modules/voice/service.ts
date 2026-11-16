import type { SpeechTranscriber } from "@/adapters/speech/transcribe";
import { parseSpokenAmount, type SpokenAmountError } from "./parse-amount";

/** 15 s de voz más un margen mínimo para el cierre del grabador. */
export const MAX_AUDIO_MS = 16_000;
/** Un webm de 15 s cabe holgadamente; por encima se rechaza sin transcribir. */
export const MAX_AUDIO_BYTES = 1_500_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp4a-latm",
  "audio/m4a",
  "audio/x-m4a",
]);

const hits = new Map<string, number[]>();

export function takeVoiceSlot(merchantId: string, now = Date.now()): boolean {
  const recent = (hits.get(merchantId) ?? []).filter(
    (at) => now - at < WINDOW_MS,
  );
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(merchantId, recent);
    return false;
  }
  recent.push(now);
  hits.set(merchantId, recent);
  return true;
}

/** Solo para pruebas: el límite vive en memoria del proceso. */
export function resetVoiceSlots(): void {
  hits.clear();
}

export type VoiceError =
  | "invalid_audio"
  | "too_large"
  | "too_long"
  | "rate_limited"
  | "unavailable"
  | "too_large_amount"
  | Exclude<SpokenAmountError, "empty" | "too_large">;

export type VoiceInterpretation =
  | { ok: true; transcript: string; amountCents: number }
  | { ok: false; error: VoiceError };

export function mimeAllowed(mimeType: string): boolean {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_MIME.has(base);
}

/**
 * Valida el audio, lo transcribe y lee un solo importe.
 * No escribe el audio ni la frase en la base.
 */
export async function interpretVoice(input: {
  merchantId: string;
  bytes: Uint8Array;
  mimeType: string;
  durationMs: number | null;
  transcriber: SpeechTranscriber;
  now?: number;
}): Promise<VoiceInterpretation> {
  if (!takeVoiceSlot(input.merchantId, input.now)) {
    return { ok: false, error: "rate_limited" };
  }
  if (!mimeAllowed(input.mimeType) || input.bytes.byteLength < 800) {
    return { ok: false, error: "invalid_audio" };
  }
  if (input.bytes.byteLength > MAX_AUDIO_BYTES) {
    return { ok: false, error: "too_large" };
  }
  if (input.durationMs !== null && input.durationMs > MAX_AUDIO_MS) {
    return { ok: false, error: "too_long" };
  }

  const transcript = await input.transcriber.transcribe({
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  if (!transcript.ok) return { ok: false, error: "unavailable" };

  const parsed = parseSpokenAmount(transcript.text);
  if (!parsed.ok) {
    return {
      ok: false,
      error:
        parsed.error === "empty"
          ? "not_understood"
          : parsed.error === "too_large"
            ? "too_large_amount"
            : parsed.error,
    };
  }
  return {
    ok: true,
    transcript: transcript.text.trim().slice(0, 180),
    amountCents: parsed.cents,
  };
}
