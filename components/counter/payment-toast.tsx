"use client";

import { CircleCheck, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { formatMxn } from "@/modules/charges/amount";
import type { CounterPaymentDto } from "@/modules/counter/types";

/** El historial usa esta misma etiqueta para el código fijo. */
export const COUNTER_PAYMENT_METHOD = "QR de mostrador";

const TOAST_MS = 6_000;

/**
 * Solo en el QR de mostrador. El cobro en vivo ya confirma en la propia
 * pantalla, y el resto de las páginas no está esperando un pago.
 */
export function CounterPaymentToaster() {
  return (
    <Toaster
      position="top-center"
      containerClassName="print:hidden"
      toastOptions={{ duration: TOAST_MS }}
    />
  );
}

/** Aviso de un pago que esta visita acaba de ver. No depende de la voz. */
export function showCounterPaymentToast(payment: CounterPaymentDto): void {
  const amount = formatMxn(payment.amountCents);

  toast.custom(
    (current) => (
      <div
        className={cn(
          "flex w-[min(100vw-2rem,22rem)] items-start gap-3 rounded-lg border border-status-success/20 bg-status-success-soft p-4 text-left shadow-card",
          current.visible
            ? "pointer-events-auto"
            : "pointer-events-none opacity-0",
        )}
      >
        <CircleCheck
          aria-hidden="true"
          className="mt-0.5 size-6 shrink-0 text-status-success"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-semibold text-status-success">Pagado</p>
          <p className="text-sm text-foreground">{COUNTER_PAYMENT_METHOD}</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {amount}
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar aviso"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-status-success hover:bg-status-success/10"
          onClick={() => toast.dismiss(current.id)}
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    ),
    {
      id: payment.id,
      duration: TOAST_MS,
      style: { background: "transparent", padding: 0, boxShadow: "none" },
    },
  );
}
