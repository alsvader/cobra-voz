"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { VOICE_COPY } from "@/modules/voice/messages";

type MicPermission = "granted" | "denied" | "prompt" | "unknown";

/** App instalada. En una pestaña de Safari este aviso no aparece. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

async function microphonePermission(): Promise<MicPermission> {
  try {
    const permissions = navigator.permissions;
    if (!permissions?.query) return "unknown";
    const status = await permissions.query({
      name: "microphone" as PermissionName,
    });
    if (
      status.state === "granted" ||
      status.state === "denied" ||
      status.state === "prompt"
    ) {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Pide el micrófono al entrar a la app instalada. No graba: el audio solo
 * empieza al mantener pulsado «Hablar para cobrar».
 */
export function MicrophonePrimer() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [insecure, setInsecure] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isInstalledApp()) return;
      if (!window.isSecureContext) {
        if (!cancelled) {
          setInsecure(true);
          setVisible(true);
        }
        return;
      }
      const state = await microphonePermission();
      if (cancelled || state === "granted") return;
      if (state === "denied") setBlocked(true);
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function allow() {
    if (!window.isSecureContext) {
      setInsecure(true);
      return;
    }
    setPending(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of media.getTracks()) track.stop();
      setVisible(false);
    } catch (error) {
      const rejected =
        error instanceof DOMException && error.name === "NotAllowedError";
      if (rejected) setDismissed(true);
    } finally {
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <Notice
      tone={blocked || dismissed || insecure ? "warning" : "info"}
      label="Micrófono"
      className="w-full"
      action={
        blocked || insecure ? undefined : (
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full"
            disabled={pending}
            onClick={() => void allow()}
          >
            {pending
              ? VOICE_COPY.installAllowPending
              : dismissed
                ? VOICE_COPY.installRetryAction
                : VOICE_COPY.installAllowAction}
          </Button>
        )
      }
    >
      {insecure
        ? VOICE_COPY.insecure
        : blocked
          ? VOICE_COPY.denied
          : dismissed
            ? VOICE_COPY.installDismissed
            : VOICE_COPY.installAllow}
    </Notice>
  );
}
