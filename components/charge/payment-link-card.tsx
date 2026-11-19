"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Muestra el enlace para copiarlo. No abre la página de pago en este celular. */
export function PaymentLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-foreground">Enlace de pago</p>
      <p className="break-all text-base text-foreground">{url}</p>
      <Button
        type="button"
        variant="outline"
        size="md"
        className="w-full"
        onClick={() => void copy()}
      >
        {copied ? "Enlace copiado" : "Copiar enlace"}
      </Button>
    </div>
  );
}
