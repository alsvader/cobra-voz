"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AmountConfirmation,
  type ConfirmResult,
} from "@/components/charge/amount-confirmation";
import { newIdempotencyKey, submitCharge } from "@/modules/charges/client";
import { ROUTES, chargePath, loginUrl } from "@/lib/routes";

/**
 * Cuerpo de P02 en la app. Al confirmar, envía el importe a `POST /api/charges`
 * y pasa a P03 (`/cobro/[id]`), que muestra el estado REAL del cobro.
 *
 * La clave de idempotencia identifica la INTENCIÓN: se conserva mientras el
 * importe no cambie (doble clic, corte de red, reintento) y se renueva si la
 * persona confirma otro importe, que es una intención nueva (RN-05, RN-07).
 *
 * Se navega con `replace`: «atrás» desde P03 no vuelve a un P02 ya confirmado.
 * Este componente nunca dibuja un QR ni anuncia un resultado de pago.
 */
export function ConfirmAmountScreen({
  initialCents,
  transcript,
}: {
  initialCents: number | null;
  transcript?: string;
}) {
  const router = useRouter();
  const intention = useRef<{ key: string; cents: number } | null>(null);

  async function handleConfirm(cents: number): Promise<ConfirmResult> {
    if (intention.current?.cents !== cents) {
      intention.current = { key: newIdempotencyKey(), cents };
    }

    const result = await submitCharge({
      amountCents: cents,
      idempotencyKey: intention.current.key,
    });

    if (result.kind === "unauthenticated") {
      router.replace(
        loginUrl({ next: ROUTES.confirmAmount, reason: "sesion-expirada" }),
      );
      return {
        status: "error",
        message: "Tu sesión expiró. Inicia sesión de nuevo.",
      };
    }
    if (result.kind === "error") {
      return { status: "error", message: result.message };
    }

    router.replace(chargePath(result.charge.id));
    return { status: "accepted" };
  }

  return (
    <AmountConfirmation
      initialCents={initialCents}
      transcript={transcript}
      onRetryVoice={
        transcript ? () => router.push(ROUTES.app) : undefined
      }
      onConfirm={handleConfirm}
      onCancel={() => router.push(ROUTES.app)}
    />
  );
}
