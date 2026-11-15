"use client";

import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";

/**
 * Aviso global de conectividad. Solo informa: sin conexión no se puede crear
 * un cobro nuevo (RN-19) y nunca se afirma el resultado de un pago.
 */
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-status-warning-soft px-4 py-2 text-center text-sm font-semibold text-status-warning"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      Sin conexión. No podemos generar un cobro nuevo.
    </div>
  );
}
