"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { qrMatrix, qrSvgPath } from "@/lib/qr";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";

export type CoDiQrCardProps = {
  /** `qrString` persistido por el backend. Nunca se inventa ni se modifica. */
  payload: string;
  /** QR del simulador (solo Local/Preview): se rotula siempre «de prueba». */
  simulated: boolean;
  /** Descripción accesible, p. ej. «Código QR para cobrar $150.00». */
  label: string;
  className?: string;
};

/**
 * `CoDiQrCard` (DESIGN.md §6.5). Dibuja el QR localmente a partir del
 * `qrString` guardado: base blanca pura, módulos negros, sin gráficos encima y
 * con zona quieta de 4 módulos. El importe, el estado y el tiempo restante se
 * muestran FUERA del código.
 */
export function CoDiQrCard({
  payload,
  simulated,
  label,
  className,
}: CoDiQrCardProps) {
  const drawing = useMemo(() => {
    try {
      return qrSvgPath(qrMatrix(payload));
    } catch {
      return null;
    }
  }, [payload]);

  if (!drawing) {
    return (
      <Notice tone="error" label="No pudimos mostrar el QR">
        El código de este cobro no se pudo dibujar. Toca «Consultar nuevamente»
        o vuelve a Inicio; no se cobrará nada con un código que no se ve bien.
      </Notice>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {simulated ? (
        <StatusBadge tone="info" label="QR de prueba · no sirve para pagar" />
      ) : null}
      <div className="rounded-lg border border-border bg-white">
        <svg
          role="img"
          aria-label={label}
          viewBox={`0 0 ${drawing.size} ${drawing.size}`}
          shapeRendering="crispEdges"
          // 232 px en 320 px de ancho; hasta 280 px en teléfonos amplios.
          className="block aspect-square w-58 min-[360px]:w-62 min-[390px]:w-70"
          data-testid="codi-qr"
        >
          <rect width="100%" height="100%" fill="#ffffff" />
          <path d={drawing.path} fill="#000000" />
        </svg>
      </div>
    </div>
  );
}
