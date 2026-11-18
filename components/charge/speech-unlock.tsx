"use client";

import { useEffect } from "react";
import { primePaymentSpeech } from "@/adapters/speech/announce";

/**
 * Cualquier toque de la visita abre el audio del iPhone. Cubre retomar un
 * cobro y recargar el QR: si el pago ya llegó, ese toque lo dice.
 */
export function SpeechUnlock() {
  useEffect(() => {
    const unlock = () => primePaymentSpeech();
    document.addEventListener("touchend", unlock, true);
    document.addEventListener("click", unlock, true);
    return () => {
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
    };
  }, []);

  return null;
}
