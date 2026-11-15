import type { ComponentProps } from "react";
import { formatMxn, spokenMxn } from "@/modules/charges/amount";
import { cn } from "@/lib/utils";

export type AmountDisplayProps = Omit<ComponentProps<"div">, "children"> & {
  /** Centavos enteros; `null` si todavía no hay un importe válido. */
  cents: number | null;
  /** Texto de apoyo sobre la cifra, p. ej. «Importe a cobrar». */
  label: string;
  /** Frase reconocida por voz (solo cuando el origen es voz). */
  transcript?: string;
};

/**
 * Importe protagonista (DESIGN.md §6.3): `text-amount` con cifras tabulares,
 * 32 px en teléfonos muy angostos y nunca por debajo de 28 px. Si no hay importe
 * válido se muestra un guion, no «$0.00»: un cero podría confundirse con un
 * importe real.
 */
export function AmountDisplay({
  cents,
  label,
  transcript,
  className,
  ...props
}: AmountDisplayProps) {
  const hasAmount = cents !== null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-4 py-8 text-center shadow-card",
        className,
      )}
      {...props}
    >
      <p className="text-base font-semibold text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-amount-sm font-bold tabular-nums break-words min-[360px]:text-amount",
          hasAmount ? "text-foreground" : "text-ink-400",
        )}
      >
        <span aria-hidden="true">{hasAmount ? formatMxn(cents) : "—"}</span>
        {/* Lectores de pantalla: «150 pesos con 50 centavos», no símbolos sueltos. */}
        <span className="sr-only">
          {hasAmount ? spokenMxn(cents) : "Sin importe"}
        </span>
      </p>
      <p className="text-sm font-semibold text-muted-foreground">
        MXN · pesos mexicanos
      </p>
      {transcript ? (
        <p className="text-base text-muted-foreground">
          Escuchamos: <q>{transcript}</q>
        </p>
      ) : null}
    </div>
  );
}
