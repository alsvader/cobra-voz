import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { buttonVariants } from "@/components/ui/button";
import { salesFilterPath } from "@/modules/sales/filter";
import { cn } from "@/lib/utils";

/**
 * Aviso de Inicio cuando hay cobros sin confirmar. No elige uno: abre Ventas
 * ya filtrado a ese estado.
 */
export function UnconfirmedChargesNotice() {
  return (
    <Notice
      tone="incident"
      label="Cobros sin confirmar"
      className="w-full"
      action={
        <Link
          href={salesFilterPath("qr_uncertain")}
          className={cn(
            buttonVariants({ variant: "secondary", size: "md" }),
            "w-full",
          )}
        >
          Ver en Ventas
        </Link>
      }
    >
      Hay cobros de los que no sabemos si se crearon.
    </Notice>
  );
}
