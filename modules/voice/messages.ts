import type { VoiceError } from "./service";

/** Textos que ve la persona. El audio y la transcripción no se guardan. */
export const VOICE_COPY = {
  unavailable:
    "Por ahora la captura por voz no está disponible. Puedes cobrar ingresando el importe manualmente.",
  denied:
    "El micrófono está bloqueado. Habilítalo en el navegador o ingresa el importe manualmente.",
  insecure:
    "Desde esta dirección el iPhone no puede pedir el micrófono. Ábrela con https.",
  silent: "No escuchamos nada. Mantén pulsado el micrófono mientras hablas.",
  network:
    "No pudimos oírte. Inténtalo de nuevo o ingresa el importe manualmente.",
  hold: "Mantén pulsado mientras hablas.",
  /**
   * La app instalada vuelve a pedir el micrófono en cada apertura. El botón
   * solo acepta el permiso; la grabación sigue en «Hablar para cobrar».
   */
  installAllow:
    "Para hablar y cobrar, acepta el micrófono. Esta app lo pide de nuevo cada vez que la abres.",
  installAllowAction: "Permitir micrófono",
  installAllowPending: "Esperando el permiso…",
  installDismissed: "No aceptaste el micrófono. Puedes intentarlo de nuevo.",
  installRetryAction: "Reintentar",
} as const;

const ERROR_COPY: Record<VoiceError, string> = {
  invalid_audio: "No recibimos un audio válido.",
  too_large: "El audio es demasiado grande.",
  too_long:
    "La grabación es demasiado larga. Di el importe en menos de 15 segundos.",
  rate_limited: "Espera un momento antes de volver a hablar.",
  unavailable: VOICE_COPY.unavailable,
  not_understood:
    "No entendimos un importe. Vuelve a hablar o ingrésalo manualmente.",
  ambiguous:
    "Escuchamos más de un importe. Di una sola cantidad o ingrésala manualmente.",
  not_positive: "El importe debe ser mayor que $0.00.",
  too_many_decimals: "Usa máximo dos decimales.",
  too_large_amount: "El importe es demasiado alto.",
};

export function voiceErrorMessage(error: VoiceError): string {
  return ERROR_COPY[error];
}

export function voiceErrorStatus(error: VoiceError): number {
  if (error === "too_large") return 413;
  if (error === "rate_limited") return 429;
  if (error === "unavailable") return 503;
  return 422;
}
