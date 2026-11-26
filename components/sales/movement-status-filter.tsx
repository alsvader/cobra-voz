import Link from "next/link";
import { movementStatus } from "@/components/sales/movement-status";
import type { ChargeStatus } from "@/modules/charges/types";
import {
  MOVEMENT_FILTER_STATUSES,
  salesFilterPath,
} from "@/modules/sales/filter";
import { cn } from "@/lib/utils";

const OPTIONS = [null, ...MOVEMENT_FILTER_STATUSES] as const;

/**
 * Filtro de Ventas. Cada estado es un enlace: cambiarlo abre la lista desde
 * el principio y el servidor vuelve a consultar.
 */
export function MovementStatusFilter({
  status,
}: {
  status: ChargeStatus | null;
}) {
  return (
    <nav aria-label="Estado" className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const selected = option === status;
        const label = option ? movementStatus(option).label : "Todos";
        return (
          <Link
            key={option ?? "todos"}
            href={salesFilterPath(option)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-md border px-3 text-sm font-semibold",
              selected
                ? "border-primary bg-secondary text-foreground"
                : "border-border bg-surface text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
