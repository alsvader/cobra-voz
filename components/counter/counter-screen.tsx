"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  announceVerifiedPayment,
  primePaymentSpeech,
} from "@/adapters/speech/announce";
import {
  CounterPaymentToaster,
  showCounterPaymentToast,
} from "@/components/counter/payment-toast";
import { CounterPaySteps } from "@/components/counter/pay-steps";
import { CoDiQrCard } from "@/components/charge/codi-qr-card";
import { Button } from "@/components/ui/button";
import { formatMxn } from "@/modules/charges/amount";
import {
  COUNTER_TEST_PAYMENT_CENTS,
  type CounterPaymentDto,
} from "@/modules/counter/types";

const POLL_MS = 5_000;

export type CounterScreenProps = {
  merchantName: string;
  payload: string;
  simulated: boolean;
  initialPayments: CounterPaymentDto[];
  /** Botón de pago de prueba. El servidor solo lo enciende en local. */
  allowTestPayment?: boolean;
};

/**
 * QR fijo, los pasos para pagarlo y los cobros que van llegando. Imprimir
 * deja en la hoja el nombre, el código y los pasos.
 */
export function CounterScreen({
  merchantName,
  payload,
  simulated,
  initialPayments,
  allowTestPayment = false,
}: CounterScreenProps) {
  const [payments, setPayments] = useState(initialPayments);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const seen = useRef(new Set(initialPayments.map((payment) => payment.id)));

  const syncPayments = useCallback(async () => {
    let response: Response;
    try {
      response = await fetch("/api/counter-qr/payments", { cache: "no-store" });
    } catch {
      return;
    }
    if (!response.ok) return;
    const body = (await response.json()) as { payments?: CounterPaymentDto[] };
    const next = Array.isArray(body.payments) ? body.payments : [];
    const fresh = next.filter((payment) => !seen.current.has(payment.id));
    if (fresh.length === 0) return;
    for (const payment of fresh) seen.current.add(payment.id);
    setPayments(next);
    for (const payment of fresh) {
      showCounterPaymentToast(payment);
      void announceVerifiedPayment(payment);
    }
  }, []);

  useEffect(() => {
    let stopped = false;

    async function tick() {
      if (stopped || document.hidden) return;
      await syncPayments();
    }

    const timer = window.setInterval(() => void tick(), POLL_MS);
    const onShow = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [syncPayments]);

  async function onTestPayment() {
    primePaymentSpeech();
    setTesting(true);
    setTestError(null);
    try {
      const response = await fetch("/api/counter-qr/test-payment", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setTestError("No se pudo registrar el pago de prueba.");
        return;
      }
      await syncPayments();
    } catch {
      setTestError("No se pudo registrar el pago de prueba.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <CounterPaymentToaster />
      <p className="text-center text-xl font-bold text-foreground">
        {merchantName}
      </p>
      <div className="print:[&_svg]:!w-72">
        <CoDiQrCard
          payload={payload}
          simulated={simulated}
          label="Código QR del mostrador. El cliente escribe el importe en su aplicación bancaria."
        />
      </div>
      <CounterPaySteps />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="print:hidden"
        onClick={() => window.print()}
      >
        Imprimir
      </Button>
      <section
        aria-label="Pagos de este código"
        className="flex w-full flex-col gap-2 print:hidden"
      >
        <h2 className="text-base font-semibold text-foreground">
          Pagos de este código
        </h2>
        {allowTestPayment ? (
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={testing}
              onClick={() => void onTestPayment()}
            >
              {testing
                ? "Registrando el pago de prueba…"
                : `Simular un pago de ${formatMxn(COUNTER_TEST_PAYMENT_CENTS)}`}
            </Button>
            {testError ? (
              <p role="alert" className="text-sm text-status-error">
                {testError}
              </p>
            ) : null}
          </div>
        ) : null}
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cuando un cliente pague, el importe aparecerá aquí.
          </p>
        ) : (
          <ul className="flex flex-col">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="border-b border-border py-3 text-lg font-semibold tabular-nums text-foreground last:border-b-0"
              >
                {formatMxn(payment.amountCents)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
