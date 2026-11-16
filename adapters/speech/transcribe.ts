/** Transcripción de un audio ya grabado. No guarda el archivo ni el texto. */
export type SpeechTranscript =
  | { ok: true; text: string }
  | { ok: false; reason: "unavailable" | "failed" };

export type SpeechTranscriber = {
  transcribe(audio: {
    bytes: Uint8Array;
    mimeType: string;
  }): Promise<SpeechTranscript>;
};

export const TRANSCRIBE_MODEL = "gpt-transcribe";

const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";

function extensionFor(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base.includes("mp4") || base.includes("m4a")) return "m4a";
  if (base.includes("mpeg")) return "mp3";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  return "webm";
}

/**
 * Llama a la API de audio de OpenAI. El modelo `gpt-transcribe` usa
 * `languages` en lugar del campo singular `language`.
 */
export function transcriberFromEnv(
  env: Record<string, string | undefined> = process.env,
): SpeechTranscriber | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return createOpenAiTranscriber({ apiKey });
}

export function createOpenAiTranscriber(options: {
  apiKey: string;
  fetch?: typeof fetch;
}): SpeechTranscriber {
  const fetchImpl = options.fetch ?? fetch;
  return {
    async transcribe(audio) {
      const fileName = `audio.${extensionFor(audio.mimeType)}`;
      const prompt = "Importe en pesos mexicanos.";
      const keywords = ["pesos", "centavos"];
      const languages = ["es"];
      const form = new FormData();
      const buffer = new ArrayBuffer(audio.bytes.byteLength);
      new Uint8Array(buffer).set(audio.bytes);
      const blob = new Blob([buffer], { type: audio.mimeType });
      form.append("file", blob, fileName);
      form.append("model", TRANSCRIBE_MODEL);
      for (const language of languages) form.append("languages[]", language);
      form.append("prompt", prompt);
      for (const keyword of keywords) form.append("keywords[]", keyword);

      console.info(
        JSON.stringify({
          event: "voice_transcribe_request",
          url: OPENAI_URL,
          model: TRANSCRIBE_MODEL,
          languages,
          prompt,
          keywords,
          fileName,
          mimeType: audio.mimeType,
          bytes: audio.bytes.byteLength,
        }),
      );

      try {
        const response = await fetchImpl(OPENAI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey}` },
          body: form,
          signal: AbortSignal.timeout(20_000),
        });
        const raw = await response.text();
        let body: unknown = raw.slice(0, 2_000);
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw.slice(0, 2_000);
        }
        console.info(
          JSON.stringify({
            event: "voice_transcribe_response",
            status: response.status,
            body,
          }).split(options.apiKey).join("[redacted]"),
        );
        if (!response.ok) return { ok: false, reason: "failed" };
        const text =
          body &&
          typeof body === "object" &&
          "text" in body &&
          typeof body.text === "string"
            ? body.text.trim()
            : "";
        if (!text) return { ok: false, reason: "failed" };
        return { ok: true, text };
      } catch (error) {
        const message = error instanceof Error ? error.message : "error";
        console.info(
          JSON.stringify({
            event: "voice_transcribe_response",
            status: null,
            error: message,
          }).split(options.apiKey).join("[redacted]"),
        );
        return { ok: false, reason: "failed" };
      }
    },
  };
}
