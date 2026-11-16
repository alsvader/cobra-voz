"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Con cacheComponents la ruta queda oculta y conserva lo que ya pintó.
 * Al volver a verse, se piden de nuevo los datos del servidor. La primera
 * visita no refresca: acaba de cargarlos.
 */
export function RefreshOnShow() {
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) router.refresh();
    shown.current = true;
  }, [router]);

  return null;
}
