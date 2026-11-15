import type { ReactNode } from "react";
import {
  ChevronDown,
  CircleCheck,
  House,
  Mic,
  ReceiptText,
  Settings,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

function PhoneFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[300px]", className)}>
      <div className="rounded-[2.4rem] bg-ink-900 p-[10px] shadow-[0_18px_40px_rgb(23_45_50/0.16)]">
        <div className="overflow-hidden rounded-[1.85rem] bg-canvas">
          <div className="flex items-center justify-between px-5 pt-2 text-[11px] font-semibold text-foreground">
            <span>9:41</span>
            <span className="h-2.5 w-4 rounded-[2px] border border-foreground" />
          </div>
          <div className="relative -mt-3 flex justify-center">
            <span className="h-5 w-24 rounded-full bg-ink-900" />
          </div>
          {children}
          <div className="flex justify-center pb-2">
            <span className="h-1 w-24 rounded-full bg-ink-900/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewFigure({
  caption,
  children,
  className,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div aria-hidden="true">{children}</div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

export function HomeScreenPreview({ className }: { className?: string }) {
  return (
    <PreviewFigure
      className={className}
      caption="Demostración de la pantalla de inicio. No inicia un cobro ni muestra un código QR."
    >
      <PhoneFrame>
        <div className="px-3 pb-2">
          <div className="flex items-start justify-between">
            <p className="text-lg font-bold text-foreground">CobraVoz</p>
            <Settings className="size-4 text-ink-600" />
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-600">
            Mi negocio
            <ChevronDown className="size-3" />
          </p>
          <div className="mt-3 rounded-[16px] bg-surface p-4 text-center shadow-card">
            <p className="text-base font-bold text-foreground">Nuevo cobro</p>
            <p className="mt-1 text-xs text-ink-600">
              Presiona el micrófono y di la cantidad
            </p>
            <span className="mx-auto mt-4 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Mic className="size-7" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">
              Hablar para cobrar
            </p>
            <span className="mt-3 inline-flex rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
              Ingresar importe manualmente
            </span>
          </div>
          <div className="mt-3 rounded-[16px] bg-surface p-4 shadow-card">
            <p className="text-xs text-ink-600">Total cobrado hoy</p>
            <p className="text-[2rem] leading-10 font-bold tabular-nums text-foreground">
              $0.00
            </p>
            <p className="text-xs text-ink-600">0 pagos confirmados</p>
          </div>
          <div className="mt-3 grid grid-cols-2 border-t border-border pt-2">
            <div className="flex flex-col items-center gap-0.5 text-teal-700">
              <House className="size-4" />
              <span className="text-[11px] font-semibold">Inicio</span>
              <span className="mt-0.5 h-0.5 w-8 rounded-full bg-teal-700" />
            </div>
            <div className="flex flex-col items-center gap-0.5 text-ink-400">
              <ReceiptText className="size-4" />
              <span className="text-[11px] font-medium">Ventas</span>
            </div>
          </div>
        </div>
      </PhoneFrame>
    </PreviewFigure>
  );
}

export function VoiceCapturePreview() {
  return (
    <PreviewFigure caption="Ejemplo ilustrativo de la captura por voz. No graba audio.">
      <div className="rounded-[16px] bg-muted p-4 text-center">
        <p className="text-base font-bold text-foreground">Nuevo cobro</p>
        <span className="mx-auto mt-4 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Mic className="size-7" />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">
          Hablar para cobrar
        </p>
        <span className="mt-3 inline-flex rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
          Ingresar importe manualmente
        </span>
      </div>
    </PreviewFigure>
  );
}

export function ConfirmAmountPreview() {
  return (
    <PreviewFigure caption="Ejemplo ilustrativo de la confirmación del importe. No genera un cobro.">
      <div className="rounded-[16px] border border-border bg-canvas p-4">
        <p className="text-sm text-ink-600">Importe a cobrar</p>
        <p className="text-[2rem] leading-10 font-bold tabular-nums text-foreground">
          $85.00
        </p>
        <p className="text-sm text-ink-600">MXN · Ejemplo ilustrativo</p>
        <span className="mt-4 flex h-12 items-center justify-center rounded-button bg-primary text-sm font-semibold text-primary-foreground">
          Confirmar importe
        </span>
      </div>
    </PreviewFigure>
  );
}

export function PaymentReceivedPreview() {
  return (
    <PreviewFigure caption="Ejemplo de un pago ya verificado. No es una operación real.">
      <div className="flex flex-col items-center rounded-[16px] bg-muted px-4 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-status-success text-white">
          <CircleCheck className="size-6" />
        </span>
        <p className="mt-3 text-base font-bold text-foreground">
          ¡Pago recibido!
        </p>
        <p className="text-[2rem] leading-10 font-bold tabular-nums text-foreground">
          $85.00
        </p>
        <p className="text-sm text-ink-600">Pago verificado · Ejemplo</p>
      </div>
    </PreviewFigure>
  );
}

export function BenefitVoicePreview() {
  return (
    <PreviewFigure
      className="mx-auto w-full max-w-[260px] translate-y-8"
      caption="Ejemplo ilustrativo de la pantalla de cobro por voz."
    >
      <PhoneFrame>
        <div className="px-4 pt-2 pb-10 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold text-teal-700">
            <Mic className="size-4" />
            CobraVoz
          </p>
          <p className="mt-6 text-base font-bold text-foreground">
            Nuevo cobro
          </p>
          <span className="mx-auto mt-5 flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Mic className="size-8" />
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground">
            Hablar para cobrar
          </p>
        </div>
      </PhoneFrame>
    </PreviewFigure>
  );
}

type PaymentStatePreviewProps = {
  tone: Extract<StatusTone, "warning" | "success">;
  label: string;
  amount: string;
  detail: string;
  reference?: string;
};

export function PaymentStatePreview({
  tone,
  label,
  amount,
  detail,
  reference,
}: PaymentStatePreviewProps) {
  return (
    <article className="rounded-[20px] bg-surface p-5 shadow-card">
      <StatusBadge tone={tone} label={label} />
      <p className="mt-4 text-[2.25rem] leading-10 font-bold tabular-nums text-foreground">
        {amount}
      </p>
      <p className="mt-2 text-base text-ink-600">{detail}</p>
      {reference ? (
        <p className="mt-1 text-sm text-ink-600">{reference}</p>
      ) : null}
    </article>
  );
}

export function DailySummaryPreview({
  totalLabel,
  total,
  count,
  sample,
}: {
  totalLabel: string;
  total: string;
  count: string;
  sample: string;
}) {
  return (
    <div className="mt-6 rounded-[16px] bg-muted p-5">
      <p className="text-sm text-ink-600">{totalLabel}</p>
      <p className="text-[2rem] leading-10 font-bold tabular-nums text-foreground">
        {total}
      </p>
      <p className="text-sm text-ink-600">{count}</p>
      <p className="text-sm text-ink-600">{sample}</p>
    </div>
  );
}
