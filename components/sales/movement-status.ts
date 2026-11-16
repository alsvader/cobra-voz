import type { StatusTone } from "@/components/ui/status-badge";
import type { ChargeStatus } from "@/modules/charges/types";

/**
 * Etiqueta visible del movimiento. El tono `success` (check) queda solo para
 * un pago conciliado: pendiente, vencido e incidencia no lo usan.
 */
export function movementStatus(status: ChargeStatus): {
  tone: StatusTone;
  label: string;
} {
  switch (status) {
    case "paid":
      return { tone: "success", label: "Pagado" };
    case "waiting_payment":
      return { tone: "warning", label: "Esperando pago" };
    case "expired":
      return { tone: "closed", label: "Expirado" };
    case "locally_closed":
      return { tone: "closed", label: "Cerrado" };
    case "incident":
      return { tone: "incident", label: "Incidencia" };
    case "qr_uncertain":
      return { tone: "incident", label: "Sin confirmar" };
    case "created":
      return { tone: "info", label: "Generando QR" };
  }
}
