"use client";

import { useEffect } from "react";

/**
 * Registra el service worker mínimo (solo fallback sin conexión).
 * Se omite en desarrollo para no interferir con HMR ni con la caché.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Sin service worker la app sigue funcionando; solo se pierde el fallback offline.
      });
  }, []);

  return null;
}
