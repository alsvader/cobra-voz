"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AmountConfirmation,
  type ConfirmResult,
} from "@/components/charge/amount-confirmation";
import { Notice } from "@/components/ui/notice";
import { formatMxn } from "@/modules/charges/amount";
import { newIdempotencyKey, submitCharge } from "@/modules/charges/client";
import type { ChargeDto } from "@/modules/charges/types";
import { ROUTES, loginUrl } from "@/lib/routes";

/**
 * Cuerpo de P02 en la app. Al confirmar, envía el importe a `POST /api/charges`.
 *
 * La clave de idempotencia identifica la INTENCIÓN: se conserva mientras el
 * importe no cambie (doble clic, corte de red, reintento) y se renueva si la
 * persona confirma otro importe, que es una intención nueva (RN-05, RN-07).
 *
 * PUNTO DE UNIÓN (PR-06): P03 (QR, estados, expiración y cierre) aún no existe.
 * Cuando exista, un cobro creado navegará a `/cobro/[id]`; hasta entonces solo
 * se informa su estado real. Nunca se muestra un QR en esta pantalla.
 */
export function ConfirmAmountScreen({
  initialCents,
}: {
  initialCents: number | null;
}) {
  const router = useRouter();
  const [charge, setCharge] = useState<ChargeDto | null>(null);
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

    setCharge(result.charge);
    return { status: "accepted" };
  }

  return (
    <>
      <AmountConfirmation
        initialCents={initialCents}
        onConfirm={handleConfirm}
        onCancel={() => router.push(ROUTES.app)}
      />
      {charge ? <ChargeCreatedNotice charge={charge} /> : null}
    </>
  );
}

function ChargeCreatedNotice({ charge }: { charge: ChargeDto }) {
  const amount = formatMxn(charge.amountCents);

  if (charge.status === "qr_uncertain") {
    return (
      <Notice tone="warning" label="No pudimos confirmar el QR">
        No sabemos si se generó el QR de {amount}. Guarda la referencia{" "}
        <strong>{charge.reference}</strong>. No se creó ningún cobro adicional y
        no repetiremos la solicitud por tu cuenta.
      </Notice>
    );
  }

  return (
    <Notice tone="info" label="Cobro creado">
      Se creó el cobro <strong>{charge.reference}</strong> por {amount}
      {charge.qr?.simulated ? " (QR de prueba)" : ""}. La pantalla que muestra
      el QR llega en el siguiente avance; todavía no hay ningún pago registrado.
    </Notice>
  );
}
