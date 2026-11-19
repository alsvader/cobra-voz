import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { buttonVariants } from "@/components/ui/button";
import { chargePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { formatMxn } from "@/modules/charges/amount";
import type { ChargeDto } from "@/modules/charges/types";

/**
 * Aviso de UF-07 al reabrir Inicio. No anuncia un pago: solo ofrece volver
 * al cobro que sigue en curso o cuyo QR no se pudo confirmar.
 */
export function PendingChargeNotice({ charge }: { charge: ChargeDto }) {
  const uncertain = charge.status === "qr_uncertain";
  const amount = formatMxn(charge.amountCents);

  return (
    <Notice
      tone={uncertain ? "incident" : "warning"}
      label={uncertain ? "Cobro sin confirmar" : "Cobro pendiente"}
      className="w-full"
      action={
        <Link
          href={chargePath(charge.id)}
          className={cn(
            buttonVariants({ variant: "secondary", size: "md" }),
            "w-full",
          )}
        >
          {uncertain ? "Ver cobro" : "Retomar cobro"}
        </Link>
      }
    >
      {uncertain
        ? charge.collectionMethod === "link" &&
          charge.creationResult === "rejected"
          ? `No pudimos crear el enlace de ${amount}. Conserva la referencia ${charge.reference}.`
          : charge.collectionMethod === "link"
            ? `No sabemos si se creó el enlace de ${amount}. Conserva la referencia ${charge.reference}.`
            : charge.collectionMethod === "pn"
              ? `No sabemos si se envió el aviso de ${amount}. Conserva la referencia ${charge.reference}.`
              : `No sabemos si se generó el código de ${amount}. Conserva la referencia ${charge.reference}.`
        : `Tienes un cobro en curso de ${amount}. Retómalo para no empezar otro.`}
    </Notice>
  );
}
