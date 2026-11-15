"use client";

import { useId, useState } from "react";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";

type Status = "idle" | "saving" | "error";

/**
 * «Anunciar pagos» (A02). Aplica el cambio al instante y lo persiste en el
 * servidor; si falla, vuelve al valor anterior y lo explica. El audio es
 * opcional: la confirmación visual de un pago nunca depende de este valor.
 */
export function VoiceAnnouncementsSwitch({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const labelId = useId();
  const descriptionId = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<Status>("idle");

  async function handleChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setStatus("saving");

    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceAnnouncementsEnabled: next }),
      });
      if (!response.ok) {
        throw new Error("preferences_update_failed");
      }
      const saved = (await response.json()) as {
        voiceAnnouncementsEnabled: boolean;
      };
      setEnabled(saved.voiceAnnouncementsEnabled);
      setStatus("idle");
    } catch {
      setEnabled(previous);
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span
            id={labelId}
            className="text-base font-semibold text-foreground"
          >
            Anunciar pagos
          </span>
          <span id={descriptionId} className="text-sm text-muted-foreground">
            Dice en voz alta cuando recibes un pago. El aviso en pantalla
            siempre aparece.
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleChange}
          disabled={status === "saving"}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
        />
      </div>

      {status === "error" ? (
        <Notice tone="error" label="No se guardó">
          No pudimos guardar tu preferencia. Revisa tu conexión e inténtalo de
          nuevo.
        </Notice>
      ) : null}
    </div>
  );
}
