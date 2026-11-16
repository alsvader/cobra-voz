import type { ChargeStatus } from "@/modules/charges/types";
import { resolveTimeZone } from "./business-day";

export function movementExplanation(status: ChargeStatus): string {
  switch (status) {
    case "paid":
      return "El banco confirmó este pago. Es el único tipo de movimiento que suma al total de hoy.";
    case "waiting_payment":
      return "Todavía no hay una confirmación bancaria. No suma al total.";
    case "expired":
      return "El cobro venció. Si tu cliente ya pagó, puede confirmarse después. No suma al total.";
    case "locally_closed":
      return "Se cerró en CobraVoz. Eso no cancela un pago en el banco y no suma al total.";
    case "incident":
      return "Hay una situación sin resolver. No cuenta como venta hasta que el banco lo confirme.";
    case "qr_uncertain":
      return "No sabemos si se generó el código. No se creó otro cobro y no suma al total.";
    case "created":
      return "Estamos generando el código. Todavía no hay un pago que sumar.";
  }
}

/** Fecha y hora en la zona del comercio, p. ej. «15 nov, 12:04». */
export function formatOccurred(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: resolveTimeZone(timeZone),
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}
