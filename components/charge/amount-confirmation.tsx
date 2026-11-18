"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { AmountDisplay } from "@/components/charge/amount-display";
import { AmountInput } from "@/components/charge/amount-input";
import { primePaymentSpeech } from "@/adapters/speech/announce";
import {
  AMOUNT_ERROR_MESSAGES,
  centsToInputValue,
  parseAmountToCents,
} from "@/modules/charges/amount";

export type ConfirmResult =
  /** El importe se aceptó: la pantalla queda bloqueada (el siguiente paso toma el control). */
  | { status: "accepted" }
  /** No se pudo continuar: se explica y se permite reintentar. */
  | { status: "error"; message: string };

export type AmountConfirmationProps = {
  /** Importe ya conocido (centavos) o `null` para captura manual desde cero. */
  initialCents: number | null;
  /** Frase reconocida por voz; omitir si el origen es manual (UX P02). */
  transcript?: string;
  /**
   * Acción explícita «Confirmar importe». Nunca se invoca sola ni con un
   * importe inválido, y a lo sumo una vez a la vez.
   */
  onConfirm: (cents: number) => Promise<ConfirmResult> | ConfirmResult;
  onCancel: () => void;
  /** Solo si la voz está disponible (PR de voz); si no, no se muestra. */
  onRetryVoice?: () => void;
};

/**
 * P02 — Confirmación del importe (UX §4, UF-05).
 *
 * - El importe es lo más visible; el CTA principal es «Confirmar importe».
 * - «Corregir importe» abre el campo integrado; la cifra se actualiza al
 *   escribir y el CTA solo se habilita con un importe válido (> 0, ≤ 2
 *   decimales). Todo importe, editado o no, pasa por el mismo CTA explícito.
 * - Mientras hay una confirmación en curso (o ya aceptada) todo se bloquea
 *   para evitar duplicados; el backend se protegerá además con idempotencia.
 */
export function AmountConfirmation({
  initialCents,
  transcript,
  onConfirm,
  onCancel,
  onRetryVoice,
}: AmountConfirmationProps) {
  const [editing, setEditing] = useState(initialCents === null);
  const [draft, setDraft] = useState(
    initialCents === null ? "" : centsToInputValue(initialCents),
  );
  const [phase, setPhase] = useState<"idle" | "pending" | "accepted">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  // Candado síncrono: dos clics seguidos no pueden disparar dos confirmaciones.
  const inFlight = useRef(false);

  // cacheComponents oculta la ruta sin desmontarla. Al volver a verla, el
  // importe tiene que salir de la visita actual, no del cobro anterior.
  useLayoutEffect(() => {
    setEditing(initialCents === null);
    setDraft(initialCents === null ? "" : centsToInputValue(initialCents));
    setPhase("idle");
    setFailure(null);
    inFlight.current = false;
  }, [initialCents, transcript]);

  const parsed = parseAmountToCents(draft);
  const cents = editing ? (parsed.ok ? parsed.cents : null) : initialCents;
  const locked = phase !== "idle";

  // Un campo vacío no es un error que mostrar: aparecería al perder el foco y
  // desplazaría los botones justo cuando se toca «Cancelar», perdiendo el toque.
  // La etiqueta y la ayuda ya indican qué escribir.
  const fieldError =
    editing && !parsed.ok && parsed.error !== "empty"
      ? AMOUNT_ERROR_MESSAGES[parsed.error]
      : undefined;

  async function confirm() {
    // Antes del await: en iPhone solo este turno puede abrir el audio.
    primePaymentSpeech();
    if (inFlight.current || cents === null) return;
    inFlight.current = true;
    setFailure(null);
    setPhase("pending");

    try {
      const result = await onConfirm(cents);
      if (result.status === "accepted") {
        setPhase("accepted");
        return;
      }
      setFailure(result.message);
    } catch {
      setFailure(
        "No pudimos continuar. Revisa tu conexión e inténtalo de nuevo.",
      );
    }
    inFlight.current = false;
    setPhase("idle");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void confirm();
  }

  function startEditing() {
    setEditing(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 py-4"
      noValidate
    >
      <AmountDisplay
        cents={cents}
        label="Importe a cobrar"
        transcript={editing ? undefined : transcript}
      />

      {editing ? (
        <AmountInput
          // Foco en el campo al corregir o al llegar desde «Ingresar manualmente».
          autoFocus
          value={draft}
          onValueChange={setDraft}
          error={fieldError}
          disabled={locked}
        />
      ) : null}

      {failure ? (
        <Notice tone="error" label="No se confirmó">
          {failure}
        </Notice>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" disabled={locked || cents === null}>
          {phase === "pending"
            ? "Generando código…"
            : phase === "accepted"
              ? "Importe confirmado"
              : "Confirmar importe"}
        </Button>

        {!editing ? (
          <Button
            variant="secondary"
            size="md"
            className="w-full"
            onClick={startEditing}
            disabled={locked}
          >
            Corregir importe
          </Button>
        ) : null}

        {onRetryVoice ? (
          <Button
            variant="outline"
            size="md"
            className="w-full"
            onClick={onRetryVoice}
            disabled={locked}
          >
            Volver a hablar
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="md"
          className="w-full"
          onClick={onCancel}
          disabled={phase === "pending"}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
