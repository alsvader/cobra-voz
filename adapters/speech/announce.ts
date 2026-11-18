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
  /** Campana de la notificación. Por defecto, `public/sounds/ding.mp3`. */
  ring?: () => void;
  hidden?: boolean;
  reducedMotion?: boolean;
  storage?: Storage | null;
};

const PAYMENT_BELL_SRC = "/sounds/ding.mp3";

let audioContext: AudioContext | null = null;
let bellBuffer: AudioBuffer | null = null;
let bellLoading: Promise<AudioBuffer | null> | null = null;

/**
 * En iPhone, el primer `speak()` tiene que ocurrir en el mismo turno del toque.
 * Una consulta posterior ya no cuenta como gesto y Safari ignora el audio.
 * Esta llamada se hace al pulsar, antes de cualquier espera. Si el pago llegó
 * antes de ese toque, la frase se dice aquí.
 */
let speechPrimed = false;
let heldAnnouncement: {
  id: string;
  phrase: string;
  storage: Storage | null;
  ring: () => void;
} | null = null;

export function resetPaymentSpeechForTests(): void {
  speechPrimed = false;
  heldAnnouncement = null;
  bellBuffer = null;
  bellLoading = null;
  const current = audioContext;
  audioContext = null;
  if (current && current.state !== "closed") {
    void current.close().catch(() => undefined);
  }
}

function iosNeedsGesture(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function primePaymentSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const activation = navigator.userActivation;
  if (activation && !activation.isActive) return;

  const held = heldAnnouncement;
  if (held) {
    heldAnnouncement = null;
    rememberAnnounced(held.id, held.storage);
    try {
      held.ring();
    } catch {
      // La campana no salió; la voz sigue.
    }
    try {
      speakWithDevice(held.phrase);
    } catch {
      // La pantalla ya mostró el pago.
    }
    speechPrimed = true;
    return;
  }

  unlockPaymentBell();
  if (speechPrimed) return;
  try {
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
    speechPrimed = true;
  } catch {
    // Si este toque no abre el audio, el anuncio real tampoco sonará.
  }
}

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

  if (deps.reducedMotion ?? prefersReducedMotion()) {
    rememberAnnounced(charge.id, storage);
    return;
  }
  if (deps.hidden ?? pageHidden()) {
    rememberAnnounced(charge.id, storage);
    return;
  }

  const enabled = await voiceAnnouncementsEnabled(deps.fetch ?? fetch);
  if (!enabled || (deps.hidden ?? pageHidden())) {
    rememberAnnounced(charge.id, storage);
    return;
  }

  const phrase = paymentAnnouncement(charge.amountCents);
  if (!phrase) {
    rememberAnnounced(charge.id, storage);
    return;
  }

  // Sin un toque previo, iPhone descarta la voz. Se dice en el siguiente.
  const ring = deps.ring ?? playPaymentBell;
  if (iosNeedsGesture() && !speechPrimed) {
    heldAnnouncement = { id: charge.id, phrase, storage, ring };
    return;
  }

  rememberAnnounced(charge.id, storage);
  try {
    ring();
  } catch {
    // La campana no salió; la voz sigue.
  }
  try {
    (deps.speak ?? speakWithDevice)(phrase);
  } catch {
    // El aviso visual sigue siendo la confirmación.
  }
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const scoped = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? scoped.webkitAudioContext ?? null;
}

function bellContext(): AudioContext | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  if (!audioContext || audioContext.state === "closed") {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function loadBellBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (bellBuffer) return Promise.resolve(bellBuffer);
  if (!bellLoading) {
    bellLoading = fetch(PAYMENT_BELL_SRC)
      .then((response) => {
        if (!response.ok) throw new Error("bell");
        return response.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((decoded) => {
        bellBuffer = decoded;
        return decoded;
      })
      .catch(() => {
        bellLoading = null;
        return null;
      });
  }
  return bellLoading;
}

/** La campana del pago. Solo suena al anunciar, nunca al abrir otra pantalla. */
function playPaymentBell(): void {
  const ctx = bellContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  void loadBellBuffer(ctx).then((buffer) => {
    if (!buffer || !audioContext || audioContext.state === "closed") return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  });
}

/**
 * En el toque solo reanuda el contexto. No reproduce ding.mp3: al salir de
 * Inicio esa reproducción se cortaba y la campana se oía igual.
 */
function unlockPaymentBell(): void {
  const ctx = bellContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  void loadBellBuffer(ctx);
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

/** La de escritorio es Paulina, voz de mujer en es-MX. Luego otras mujeres en español. */
const FEMALE_VOICE_RANK = [
  "paulina",
  "angelica",
  "monica",
  "marisol",
  "soledad",
  "penelope",
];

function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function preferredFemaleVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  let best: SpeechSynthesisVoice | undefined;
  let bestScore = 0;
  for (const voice of voices) {
    const lang = voice.lang.toLowerCase();
    if (!lang.startsWith("es")) continue;
    const name = foldName(voice.name);
    const rank = FEMALE_VOICE_RANK.findIndex((item) => name.includes(item));
    if (rank === -1) continue;
    let score = 100 - rank;
    if (lang === "es-mx") score += 40;
    if (voice.localService) score += 5;
    if (name.includes("premium") || name.includes("enhanced")) score += 2;
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

function speakWithDevice(phrase: string): void {
  const synthesis = window.speechSynthesis;
  if (!synthesis) return;

  let spoken = false;
  const speakNow = () => {
    if (spoken) return;
    spoken = true;
    const utterance = new SpeechSynthesisUtterance(phrase);
    const voice = preferredFemaleVoice(synthesis.getVoices());
    utterance.lang = voice?.lang || "es-MX";
    if (voice) utterance.voice = voice;
    // En iPhone, cancel() justo antes de speak() se lleva también la frase nueva.
    if (!synthesis.speaking && !synthesis.pending) {
      synthesis.speak(utterance);
      return;
    }
    synthesis.cancel();
    window.setTimeout(() => synthesis.speak(utterance), 50);
  };

  if (
    preferredFemaleVoice(synthesis.getVoices()) ||
    typeof synthesis.addEventListener !== "function"
  ) {
    speakNow();
    return;
  }

  const onVoices = () => {
    synthesis.removeEventListener("voiceschanged", onVoices);
    if (preferredFemaleVoice(synthesis.getVoices())) speakNow();
  };
  synthesis.addEventListener("voiceschanged", onVoices);
  window.setTimeout(() => {
    synthesis.removeEventListener("voiceschanged", onVoices);
    speakNow();
  }, 500);
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
