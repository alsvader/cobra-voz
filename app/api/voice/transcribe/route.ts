import { transcriberFromEnv } from "@/adapters/speech/transcribe";
import { withMerchantApi } from "@/modules/identity/api";
import { errorJson, privateJson } from "@/lib/security/responses";
import { voiceErrorMessage, voiceErrorStatus } from "@/modules/voice/messages";
import { MAX_AUDIO_BYTES, interpretVoice } from "@/modules/voice/service";

/**
 * POST /api/voice/transcribe. La sesión aporta el comercio.
 * No guarda el audio ni la frase: solo responde el texto y los centavos
 * para que la persona los confirme en P02.
 */
export const POST = withMerchantApi(async (request, { merchantId }) => {
  const transcriber = transcriberFromEnv();
  if (!transcriber) {
    return errorJson(503, "unavailable", voiceErrorMessage("unavailable"));
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + 64_000) {
    return errorJson(413, "too_large", voiceErrorMessage("too_large"));
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) {
    return errorJson(422, "invalid_audio", voiceErrorMessage("invalid_audio"));
  }

  const durationRaw = form?.get("durationMs");
  const durationMs =
    typeof durationRaw === "string" && durationRaw.trim() !== ""
      ? Number(durationRaw)
      : null;
  if (durationMs !== null && !Number.isFinite(durationMs)) {
    return errorJson(422, "invalid_audio", voiceErrorMessage("invalid_audio"));
  }

  const result = await interpretVoice({
    merchantId,
    bytes: new Uint8Array(await file.arrayBuffer()),
    mimeType: file.type,
    durationMs,
    transcriber,
  });

  if (!result.ok) {
    return errorJson(
      voiceErrorStatus(result.error),
      result.error,
      voiceErrorMessage(result.error),
    );
  }

  return privateJson({
    transcript: result.transcript,
    amountCents: result.amountCents,
  });
});
