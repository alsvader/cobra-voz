import { ROUTES } from "@/lib/routes";
import type { ChargeStatus } from "@/modules/charges/types";

/** Orden del filtro de Ventas. Las etiquetas salen de `movementStatus`. */
export const MOVEMENT_FILTER_STATUSES = [
  "paid",
  "waiting_payment",
  "expired",
  "locally_closed",
  "incident",
  "qr_uncertain",
  "created",
] as const satisfies readonly ChargeStatus[];

/** `null` es «Todos». Un valor desconocido también: no esconde el historial. */
export function parseMovementStatus(
  raw: string | null | undefined,
): ChargeStatus | null {
  if (!raw) return null;
  return (MOVEMENT_FILTER_STATUSES as readonly string[]).includes(raw)
    ? (raw as ChargeStatus)
    : null;
}

export function salesFilterPath(status: ChargeStatus | null): string {
  if (!status) return ROUTES.sales;
  return `${ROUTES.sales}?${new URLSearchParams({ estado: status }).toString()}`;
}

export function salesApiPath(
  cursor: string,
  status: ChargeStatus | null,
): string {
  const params = new URLSearchParams({ cursor });
  if (status) params.set("estado", status);
  return `/api/sales?${params.toString()}`;
}
