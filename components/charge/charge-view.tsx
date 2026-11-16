import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { AmountDisplay } from "@/components/charge/amount-display";
import { CoDiQrCard } from "@/components/charge/codi-qr-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ROUTES, salePath } from "@/lib/routes";
import { formatMxn } from "@/modules/charges/amount";
import type { ChargeDto } from "@/modules/charges/types";

export type ChargeViewProps = {
  charge: ChargeDto;
  /** Tiempo restante según el servidor; `null` si no aplica. */
  remainingMs: number | null;
  /** `unavailable` = no pudimos consultar al servidor (no es un rechazo). */
  connection: "ok" | "unavailable";
  refreshing: boolean;
  closeError: string | null;
  onRefresh: () => void;
  onRequestClose: () => void;
};

/** «mm:ss» para el tiempo restante. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * P03 — Cobro CoDi (UX §4). Una sola vista con variantes según el estado
 * PERSISTIDO en backend; nada aquí decide por sí solo que un pago ocurrió,
 * venció o se cerró. Sin barra inferior.
 */
export function ChargeView({
  charge,
  remainingMs,
  connection,
  refreshing,
  closeError,
  onRefresh,
  onRequestClose,
}: ChargeViewProps) {
  const amount = formatMxn(charge.amountCents);
  const heading = (
    <AmountDisplay
      cents={charge.amountCents}
      label="Importe a cobrar"
      className="gap-1 py-5"
    />
  );
  const referenceLine = (
    <p className="text-center text-base text-muted-foreground">
      Referencia{" "}
      <strong className="font-semibold tabular-nums text-foreground">
        {charge.reference}
      </strong>
    </p>
  );
  const goHome = (label: string) => (
    <Link
      href={ROUTES.app}
      className={buttonVariants({
        variant: label === "Nuevo cobro" ? "primary" : "outline",
        size: "lg",
      })}
    >
      {label}
    </Link>
  );
  const detail = (
    <Link
      href={salePath(charge.id, "cobro")}
      className={buttonVariants({ variant: "outline", size: "md" })}
    >
      Ver detalle
    </Link>
  );

  switch (charge.status) {
    case "created":
      return (
        <Stack>
          <Notice tone="info" label="Generando QR">
            Estamos generando el código. Todavía no hay nada que cobrar: no
            cierres esta pantalla.
          </Notice>
          {heading}
          {referenceLine}
          <div
            className="mx-auto flex aspect-square w-58 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-muted-foreground min-[360px]:w-62"
            aria-hidden="true"
          >
            <LoaderCircle className="size-8 animate-spin motion-reduce:animate-none" />
          </div>
          <Unavailable connection={connection} />
        </Stack>
      );

    case "waiting_payment": {
      const qr = charge.qr;
      return (
        <Stack>
          <Notice tone="warning" label="Esperando pago">
            {qr
              ? "Pídele a tu cliente que escanee el código con su app bancaria. Solo marcaremos «Pagado» cuando el banco lo confirme."
              : "No encontramos el código de este cobro. No cobres con él; vuelve a Inicio y crea un cobro nuevo."}
          </Notice>
          <Unavailable connection={connection} />
          {heading}
          {qr ? (
            <CoDiQrCard
              payload={qr.payload}
              simulated={qr.simulated}
              label={`Código QR de CoDi para cobrar ${amount}`}
            />
          ) : null}
          {referenceLine}
          {remainingMs !== null ? (
            <p
              role="timer"
              className="text-center text-base font-semibold text-foreground"
            >
              {remainingMs > 0 ? (
                <>
                  Tiempo restante{" "}
                  <span className="tabular-nums">
                    {formatRemaining(remainingMs)}
                  </span>
                </>
              ) : (
                "Verificando el vencimiento…"
              )}
            </p>
          ) : null}
          {closeError ? (
            <Notice tone="error" label="No se cerró el cobro">
              {closeError}
            </Notice>
          ) : null}
          <div className="flex flex-col gap-6">
            <Button onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Consultando…" : "Consultar nuevamente"}
            </Button>
            <Button variant="outline" size="md" onClick={onRequestClose}>
              Cerrar cobro
            </Button>
          </div>
        </Stack>
      );
    }

    case "paid":
      return (
        <Stack>
          <Notice tone="success" label="¡Pago recibido!">
            El banco confirmó el pago de {amount}.
          </Notice>
          {heading}
          {referenceLine}
          <div className="flex flex-col gap-3">
            {goHome("Nuevo cobro")}
            {detail}
          </div>
        </Stack>
      );

    case "expired":
      return (
        <Stack>
          <Notice tone="closed" label="Cobro expirado">
            Este cobro venció. Eso no significa que el pago se haya rechazado:
            si tu cliente ya pagó, el banco puede confirmarlo más tarde.
          </Notice>
          {heading}
          {referenceLine}
          <div className="flex flex-col gap-3">
            {goHome("Nuevo cobro")}
            {detail}
          </div>
        </Stack>
      );

    case "locally_closed":
      return (
        <Stack>
          <Notice tone="closed" label="Cobro cerrado">
            Solo se cerró en CobraVoz; no cancela un pago en el banco.
          </Notice>
          {heading}
          {referenceLine}
          <div className="flex flex-col gap-3">
            {goHome("Volver a Inicio")}
            {detail}
          </div>
        </Stack>
      );

    case "qr_uncertain":
      return (
        <Stack>
          <Notice tone="incident" label="No pudimos confirmar el QR">
            No sabemos si se generó el código de {amount}. Guarda la referencia.
            No se creó ningún cobro adicional y no repetiremos la solicitud por
            tu cuenta.
          </Notice>
          {heading}
          {referenceLine}
          {goHome("Volver a Inicio")}
        </Stack>
      );

    case "incident":
      return (
        <Stack>
          <Notice tone="incident" label="Incidencia">
            Hay una situación sin resolver con este cobro. Guarda la referencia:
            no lo daremos por pagado hasta que el banco lo confirme.
          </Notice>
          {heading}
          {referenceLine}
          <div className="flex flex-col gap-3">
            {goHome("Volver a Inicio")}
            {detail}
          </div>
        </Stack>
      );
  }
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5 py-4">{children}</div>;
}

function Unavailable({ connection }: { connection: "ok" | "unavailable" }) {
  if (connection === "ok") return null;
  return (
    <Notice tone="warning" label="Verificación no disponible">
      No pudimos consultar el estado del cobro. Eso no significa que el pago
      haya fallado; seguiremos intentando.
    </Notice>
  );
}
