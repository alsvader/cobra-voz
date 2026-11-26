import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { buttonVariants } from "@/components/ui/button";
import { chargePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { formatMxn } from "@/modules/charges/amount";
import type { ChargeDto } from "@/modules/charges/types";

/**
 * Aviso de UF-07 al reabrir Inicio. No anuncia un pago: solo ofrece volver
 * al cobro que sigue en curso. Los sin confirmar van a Ventas.
 */
export function PendingChargeNotice({ charge }: { charge: ChargeDto }) {
  const amount = formatMxn(charge.amountCents);

  return (
    <Notice
      tone="warning"
      label="Cobro pendiente"
      className="w-full"
      action={
        <Link
          href={chargePath(charge.id)}
          className={cn(
            buttonVariants({ variant: "secondary", size: "md" }),
            "w-full",
          )}
        >
          Retomar cobro
        </Link>
      }
    >
      {`Tienes un cobro en curso de ${amount}. Retómalo para no empezar otro.`}
    </Notice>
  );
}
