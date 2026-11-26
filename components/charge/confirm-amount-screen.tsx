"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AmountConfirmation,
  type ConfirmCharge,
  type ConfirmResult,
} from "@/components/charge/amount-confirmation";
import { parseCentsParam } from "@/modules/charges/amount";
import { newIdempotencyKey, submitCharge } from "@/modules/charges/client";
import {
  parseSpokenAmount,
  spokenTranscriptParam,
} from "@/modules/voice/parse-amount";
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
export function ConfirmAmountScreen() {
  const router = useRouter();
  const search = useSearchParams();
  // La URL manda. La ruta puede reaparecer con el importe de un cobro ya cerrado.
  const initialCents = parseCentsParam(search.get("centavos"));
  const phrase = spokenTranscriptParam(search.get("frase") ?? undefined);
  const parsed = phrase ? parseSpokenAmount(phrase) : null;
  const transcript =
    initialCents !== null && parsed?.ok && parsed.cents === initialCents
      ? phrase
      : null;
  const intention = useRef<{
    key: string;
    cents: number;
    method: ConfirmCharge["method"];
    phone: string | null;
    concept: string | null;
  } | null>(null);

  async function handleConfirm(charge: ConfirmCharge): Promise<ConfirmResult> {
    if (
      intention.current?.cents !== charge.cents ||
      intention.current.method !== charge.method ||
      intention.current.phone !== charge.phoneNumber ||
      intention.current.concept !== charge.concept
    ) {
      intention.current = {
        key: newIdempotencyKey(),
        cents: charge.cents,
        method: charge.method,
        phone: charge.phoneNumber,
        concept: charge.concept,
      };
    }

    const result = await submitCharge({
      amountCents: charge.cents,
      idempotencyKey: intention.current.key,
      method: charge.method,
      phoneNumber: charge.phoneNumber,
      concept: charge.concept,
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
      key={`${initialCents ?? "manual"}:${transcript ?? ""}`}
      initialCents={initialCents}
      transcript={transcript ?? undefined}
      onRetryVoice={transcript ? () => router.push(ROUTES.app) : undefined}
      onConfirm={handleConfirm}
      onCancel={() => router.push(ROUTES.app)}
    />
  );
}
