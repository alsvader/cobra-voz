"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AmountConfirmation,
  type ConfirmResult,
} from "@/components/charge/amount-confirmation";
import { Notice } from "@/components/ui/notice";
import { formatMxn } from "@/modules/charges/amount";
import { ROUTES } from "@/lib/routes";

/**
 * Cuerpo de P02 en la app. Conecta «Cancelar» con Inicio.
 *
 * PUNTO DE UNIÓN (PR-05): aquí se llamará a `POST /api/charges` con el importe
 * confirmado y una clave de idempotencia por intención, y se navegará a P03.
 * Hasta entonces NO se crea ningún cobro ni QR: solo se deja constancia visible
 * de que el importe fue confirmado, sin fingir un cobro.
 */
export function ConfirmAmountScreen({
  initialCents,
}: {
  initialCents: number | null;
}) {
  const router = useRouter();
  const [confirmedCents, setConfirmedCents] = useState<number | null>(null);

  function handleConfirm(cents: number): ConfirmResult {
    setConfirmedCents(cents);
    return { status: "accepted" };
  }

  return (
    <>
      <AmountConfirmation
        initialCents={initialCents}
        onConfirm={handleConfirm}
        onCancel={() => router.push(ROUTES.app)}
      />
      {confirmedCents !== null ? (
        <Notice tone="info" label="Importe confirmado">
          Confirmaste {formatMxn(confirmedCents)}. Todavía no se generó ningún
          cobro ni QR: esa parte llega en el siguiente avance.
        </Notice>
      ) : null}
    </>
  );
}
