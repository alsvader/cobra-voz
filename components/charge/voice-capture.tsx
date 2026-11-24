"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MicrophonePrimer } from "@/components/charge/microphone-primer";
import { Notice } from "@/components/ui/notice";
import {
  VoiceCaptureButton,
  type VoiceCaptureState,
} from "@/components/charge/voice-capture-button";
import { ROUTES } from "@/lib/routes";
import { VOICE_COPY } from "@/modules/voice/messages";

const MAX_RECORDING_MS = 15_000;
const MIN_AUDIO_BYTES = 800;

type Phase = "idle" | "listening" | "processing";

function supportedMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

function messageFrom(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const error = body.error;
  if (!error || typeof error !== "object" || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message.slice(0, 240) : null;
}

/**
 * Pulsar y mantener para grabar. Suelta, o al llegar a 15 s, envía el audio.
 * Un importe claro abre P02 para confirmarlo. Esta pantalla no crea el cobro.
 */
export function VoiceCapture({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const released = useRef(false);
  const busy = useRef(false);
  const visible = useRef(true);
  const timer = useRef<number | null>(null);

  function stopStream() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  // Con cacheComponents la ruta queda oculta, no se desmonta. Si no se
  // reinicia aquí, al volver el micrófono sigue en «Reconociendo importe…».
  useLayoutEffect(() => {
    visible.current = true;
    return () => {
      visible.current = false;
      released.current = true;
      clearTimer();
      busy.current = false;
      const current = recorder.current;
      recorder.current = null;
      stopStream();
      if (current && current.state !== "inactive") current.stop();
      setPhase("idle");
      setMessage(null);
    };
  }, []);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function finish() {
    clearTimer();
    busy.current = false;
    recorder.current = null;
    setPhase("idle");
  }

  async function upload(blob: Blob, durationMs: number) {
    if (!visible.current) return;
    setPhase("processing");
    if (blob.size < MIN_AUDIO_BYTES) {
      setMessage(VOICE_COPY.silent);
      finish();
      return;
    }

    try {
      const form = new FormData();
      form.append("audio", blob, "audio");
      form.append("durationMs", String(durationMs));
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });
      if (!visible.current) return;
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(messageFrom(body) ?? VOICE_COPY.network);
        finish();
        return;
      }
      const transcript =
        body &&
        typeof body === "object" &&
        "transcript" in body &&
        typeof body.transcript === "string"
          ? body.transcript
          : "";
      const amountCents =
        body &&
        typeof body === "object" &&
        "amountCents" in body &&
        typeof body.amountCents === "number"
          ? body.amountCents
          : null;
      if (!transcript || amountCents === null) {
        setMessage(VOICE_COPY.network);
        finish();
        return;
      }
      const params = new URLSearchParams({
        centavos: String(amountCents),
        frase: transcript,
      });
      busy.current = false;
      recorder.current = null;
      setPhase("idle");
      router.push(`${ROUTES.confirmAmount}?${params.toString()}`);
    } catch {
      setMessage(VOICE_COPY.network);
      finish();
    }
  }

  function stop() {
    clearTimer();
    const current = recorder.current;
    if (!current) {
      released.current = true;
      return;
    }
    if (current.state !== "inactive") current.stop();
  }

  async function begin() {
    if (!enabled || busy.current || typeof MediaRecorder === "undefined") {
      if (typeof MediaRecorder === "undefined") {
        setMessage(VOICE_COPY.unavailable);
      }
      return;
    }
    if (!window.isSecureContext) {
      setMessage(VOICE_COPY.insecure);
      return;
    }
    busy.current = true;
    released.current = false;
    setMessage(null);
    setPhase("listening");

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage(VOICE_COPY.denied);
      finish();
      return;
    }
    stream.current = media;

    if (released.current || !visible.current) {
      stopStream();
      finish();
      return;
    }

    const mime = supportedMime();
    const chunks: Blob[] = [];
    const started = Date.now();
    const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
    rec.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    rec.addEventListener("stop", () => {
      stopStream();
      if (!visible.current) return;
      const blob = new Blob(chunks, {
        type: rec.mimeType || mime || "audio/webm",
      });
      void upload(blob, Date.now() - started);
    });
    recorder.current = rec;
    rec.start();
    timer.current = window.setTimeout(() => stop(), MAX_RECORDING_MS);
  }

  const state: VoiceCaptureState = enabled ? phase : "unavailable";

  return (
    <>
      {enabled ? <MicrophonePrimer /> : null}
      <VoiceCaptureButton
        state={state}
        className="touch-none"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          void begin();
        }}
        onPointerUp={() => stop()}
        onPointerCancel={() => stop()}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.repeat) return;
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          void begin();
        }}
        onKeyUp={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          stop();
        }}
      />
      {enabled && phase === "idle" && !message ? (
        <p className="text-center text-sm text-ink-600">{VOICE_COPY.hold}</p>
      ) : null}
      {!enabled ? (
        <Notice tone="info" label="Voz no disponible" className="w-full">
          {VOICE_COPY.unavailable}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone="warning" label="Voz" className="w-full">
          {message}
        </Notice>
      ) : null}
    </>
  );
}
