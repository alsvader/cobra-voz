import { formatMxn } from "@/modules/charges/amount";
import { cn } from "@/lib/utils";

export type DailySummaryProps = {
  totalCents: number;
  count: number;
  /** P01 es compacto; P04 ocupa más. Ninguno dibuja una gráfica. */
  variant: "compact" | "full";
};

function countLabel(count: number): string {
  if (count === 1) return "1 pago confirmado";
  return `${count} pagos confirmados`;
}

/** Total del día comercial. $0.00 es un total real: no hubo pagos conciliados. */
export function DailySummary({ totalCents, count, variant }: DailySummaryProps) {
  const full = variant === "full";

  return (
    <section
      aria-label="Resumen de hoy"
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border bg-surface",
        full ? "p-5" : "p-4",
      )}
    >
      <h2 className="text-sm font-semibold text-muted-foreground">
        Total cobrado hoy
      </h2>
      <p
        className={cn(
          "font-bold tabular-nums text-foreground",
          full ? "text-amount" : "text-amount-sm",
        )}
      >
        {formatMxn(totalCents)}
      </p>
      <p className="text-base text-foreground">{countLabel(count)}</p>
    </section>
  );
}
