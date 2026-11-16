import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { salePath, type SaleOrigin } from "@/lib/routes";
import { formatMxn } from "@/modules/charges/amount";
import type { MovementDto } from "@/modules/sales/types";
import { movementStatus } from "./movement-status";

export function TransactionRow({
  movement,
  from,
}: {
  movement: MovementDto;
  from: SaleOrigin;
}) {
  const status = movementStatus(movement.status);

  return (
    <li>
      <Link
        href={salePath(movement.id, from)}
        className="flex min-h-16 items-center gap-3 rounded-md py-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold tabular-nums text-foreground">
            {formatMxn(movement.amountCents)}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {movement.occurredLabel}
            <span className="sr-only">, referencia </span>
            <span aria-hidden="true"> · </span>
            {movement.reference}
          </span>
        </span>
        <StatusBadge tone={status.tone} label={status.label} />
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
      </Link>
    </li>
  );
}
