import { amountInWords } from "@/modules/charges/amount-words";

/** Frase que oye el comerciante. `null` si el importe no se puede decir. */
export function paymentAnnouncement(cents: number): string | null {
  const words = amountInWords(cents);
  if (!words) return null;
  return `¡Pago recibido! ${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

export function announcedStorageKey(chargeId: string): string {
  return `cobravoz:payment-announced:${chargeId}`;
}

export type AnnounceDeps = {
  fetch?: typeof fetch;
  speak?: (phrase: string) => void;
  hidden?: boolean;
  reducedMotion?: boolean;
  storage?: Storage | null;
};

/**
 * Dice una sola vez el importe de un pago recién verificado.
 * Si el navegador bloquea el audio, no reintenta: la pantalla ya lo muestra.
 */
export async function announceVerifiedPayment(
  charge: { id: string; amountCents: number },
  deps: AnnounceDeps = {},
): Promise<void> {
  const storage =
    deps.storage === undefined ? sessionStorageOrNull() : deps.storage;
  if (alreadyAnnounced(charge.id, storage)) return;
  rememberAnnounced(charge.id, storage);

  if (deps.reducedMotion ?? prefersReducedMotion()) return;
  if (deps.hidden ?? pageHidden()) return;

  const enabled = await voiceAnnouncementsEnabled(deps.fetch ?? fetch);
  if (!enabled) return;
  if (deps.hidden ?? pageHidden()) return;

  const phrase = paymentAnnouncement(charge.amountCents);
  if (!phrase) return;
  try {
    (deps.speak ?? speakWithDevice)(phrase);
  } catch {
    // El aviso visual sigue siendo la confirmación.
  }
}

async function voiceAnnouncementsEnabled(
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl("/api/preferences", { cache: "no-store" });
    if (!response.ok) return false;
    const body = (await response.json()) as {
      voiceAnnouncementsEnabled?: unknown;
    };
    return body.voiceAnnouncementsEnabled === true;
  } catch {
    return false;
  }
}

function speakWithDevice(phrase: string): void {
  const synthesis = window.speechSynthesis;
  if (!synthesis) return;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = "es-MX";
  const voices = synthesis.getVoices();
  const voice =
    voices.find((item) => item.lang.toLowerCase() === "es-mx") ??
    voices.find((item) => item.lang.toLowerCase().startsWith("es"));
  if (voice) utterance.voice = voice;
  synthesis.speak(utterance);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function pageHidden(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function alreadyAnnounced(chargeId: string, storage: Storage | null): boolean {
  try {
    return storage?.getItem(announcedStorageKey(chargeId)) === "1";
  } catch {
    return false;
  }
}

function rememberAnnounced(chargeId: string, storage: Storage | null): void {
  try {
    storage?.setItem(announcedStorageKey(chargeId), "1");
  } catch {
    // En modo privado el id no se guarda; esta llamada ya no se repite.
  }
}
