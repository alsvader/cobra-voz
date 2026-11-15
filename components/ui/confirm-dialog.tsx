"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Acción en curso: bloquea ambos botones y el cierre con Escape. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmación modal (DESIGN.md §6.8) sobre `<dialog>` nativo: el navegador
 * aporta el foco atrapado, Escape y la inertización del fondo. El foco inicial
 * va a la opción segura («cancelar»), no a la que ejecuta la acción.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Foco inicial explícito en la opción segura (React no emite `autofocus`).
      cancelRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Escape: se resuelve con el estado de React, no con el del navegador.
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-surface p-5 text-foreground shadow-card backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        <p id={descriptionId} className="text-base text-muted-foreground">
          {description}
        </p>
        <div className="flex flex-col gap-3">
          <Button
            size="md"
            className="w-full"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
          <Button
            variant="outline"
            size="md"
            className="w-full"
            onClick={onCancel}
            disabled={busy}
            ref={cancelRef}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
