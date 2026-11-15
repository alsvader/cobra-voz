import type { ComponentProps } from "react";
import { LoaderCircle, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceCaptureState =
  | "idle"
  | "listening"
  | "processing"
  /** Servicio de voz no disponible: la captura manual sigue disponible. */
  | "unavailable";

const LABELS: Record<VoiceCaptureState, string> = {
  idle: "Hablar para cobrar",
  listening: "Escuchando…",
  processing: "Reconociendo importe…",
  unavailable: "Hablar para cobrar",
};

export type VoiceCaptureButtonProps = Omit<
  ComponentProps<"button">,
  "children" | "disabled"
> & {
  state: VoiceCaptureState;
};

/**
 * Control circular de micrófono (DESIGN.md §6.2): 112 px (96 px en pantallas
 * muy angostas), ícono de 40 px y etiqueta debajo. Es solo presentación: la
 * captura real llega en H6. Mientras escucha o procesa no admite otra pulsación.
 * La animación es decorativa y nunca implica que la grabación haya funcionado.
 */
export function VoiceCaptureButton({
  state,
  className,
  ...props
}: VoiceCaptureButtonProps) {
  const label = LABELS[state];
  const busy = state === "processing";

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        aria-label={label}
        aria-busy={busy || undefined}
        aria-pressed={state === "listening" ? true : undefined}
        disabled={state === "unavailable" || busy}
        className={cn(
          "flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card max-[340px]:size-24",
          "transition-colors duration-150 ease-out hover:bg-teal-700 active:bg-teal-700",
          "disabled:bg-muted disabled:text-ink-400 disabled:shadow-none",
          state === "listening" &&
            "ring-4 ring-teal-700 ring-offset-4 ring-offset-canvas",
          className,
        )}
        {...props}
      >
        {busy ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-10 motion-safe:animate-spin"
          />
        ) : (
          <Mic aria-hidden="true" className="size-10" />
        )}
      </button>
      <p
        className="text-lg font-semibold text-foreground"
        aria-live="polite"
        data-testid="voice-capture-label"
      >
        {label}
      </p>
    </div>
  );
}
