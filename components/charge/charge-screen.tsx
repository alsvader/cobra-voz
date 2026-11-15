"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChargeView } from "@/components/charge/charge-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { chargePath, loginUrl } from "@/lib/routes";
import { fetchCharge, requestCloseCharge } from "@/modules/charges/client";
import type { ChargeDto } from "@/modules/charges/types";

/** Consulta periódica controlada (sin WebSockets en el MVP). */
const POLL_GENERATING_MS = 2_000;
const POLL_WAITING_MS = 5_000;
const POLL_UNAVAILABLE_MS = 10_000;

export type ChargeScreenProps = {
  /** Estado persistido leído en el servidor al abrir la pantalla. */
  initialCharge: ChargeDto;
  /** Hora del servidor (ms) en ese momento: base del tiempo restante. */
  serverTime: number;
};

/**
 * Cuerpo de P03. Mantiene el cobro sincronizado con el backend:
 *  - Consulta periódica mientras el cobro está en curso (se pausa con la
 *    pestaña oculta y se reanuda al volver o al recuperar la conexión).
 *  - El tiempo restante se calcula con la hora del SERVIDOR y un reloj
 *    monotónico; al llegar a cero solo se pide al servidor que lo confirme.
 *  - Ningún estado se cambia por una acción local: pagado, vencido y cerrado
 *    salen siempre de la respuesta del backend.
 */
export function ChargeScreen({ initialCharge, serverTime }: ChargeScreenProps) {
  const router = useRouter();
  const chargeId = initialCharge.id;

  const [charge, setCharge] = useState(initialCharge);
  const [serverNow, setServerNow] = useState(serverTime);
  const [elapsed, setElapsed] = useState({ base: serverTime, ms: 0 });
  const [connection, setConnection] = useState<"ok" | "unavailable">("ok");
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const refreshInFlight = useRef(false);
  /** Sube con cada cierre: descarta lecturas iniciadas antes de él. */
  const epoch = useRef(0);

  // El router se lee desde una ref para que `refresh` conserve su identidad:
  // de ella dependen los efectos de consulta periódica y de fin de tiempo.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const goToLogin = useCallback(() => {
    routerRef.current.replace(
      loginUrl({ next: chargePath(chargeId), reason: "sesion-expirada" }),
    );
  }, [chargeId]);

  const apply = useCallback((next: ChargeDto, at: number) => {
    setCharge(next);
    setServerNow(at);
    setConnection("ok");
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const startedAt = epoch.current;
    setRefreshing(true);
    try {
      const result = await fetchCharge(chargeId);
      if (epoch.current !== startedAt) return;
      if (result.kind === "ok") {
        apply(result.charge, result.serverTime);
      } else if (result.kind === "unauthenticated") {
        goToLogin();
      } else {
        // Sin red, error o 404 inesperado: «verificación no disponible».
        setConnection("unavailable");
      }
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [chargeId, apply, goToLogin]);

  const status = charge.status;
  const inProgress = status === "created" || status === "waiting_payment";

  // Consulta periódica mientras el cobro está en curso.
  useEffect(() => {
    if (!inProgress) return;

    const delay =
      connection === "unavailable"
        ? POLL_UNAVAILABLE_MS
        : status === "created"
          ? POLL_GENERATING_MS
          : POLL_WAITING_MS;

    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (!document.hidden) await refresh();
      if (!stopped) timer = setTimeout(() => void tick(), delay);
    };
    timer = setTimeout(() => void tick(), delay);

    const onResume = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("online", onResume);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("online", onResume);
    };
  }, [inProgress, status, connection, refresh]);

  // Reloj monotónico desde la última hora de servidor recibida.
  useEffect(() => {
    if (status !== "waiting_payment") return;
    const base = serverNow;
    const startedAt = performance.now();
    const interval = setInterval(
      () => setElapsed({ base, ms: performance.now() - startedAt }),
      1_000,
    );
    return () => clearInterval(interval);
  }, [status, serverNow]);

  const expiresAtMs = charge.expiresAt ? Date.parse(charge.expiresAt) : null;
  const remainingMs =
    status === "waiting_payment" && expiresAtMs !== null
      ? Math.max(
          0,
          expiresAtMs -
            serverNow -
            (elapsed.base === serverNow ? elapsed.ms : 0),
        )
      : null;

  // Al agotarse el tiempo solo se PIDE al servidor que lo confirme.
  const timeIsUp = remainingMs === 0;
  useEffect(() => {
    if (timeIsUp) void refresh();
  }, [timeIsUp, refresh]);

  async function closeCharge() {
    setClosing(true);
    setCloseError(null);
    epoch.current += 1;
    const result = await requestCloseCharge(chargeId);
    setClosing(false);

    if (result.kind === "ok" || result.kind === "not_closable") {
      apply(result.charge, result.serverTime);
      setConfirmingClose(false);
      return;
    }
    if (result.kind === "unauthenticated") {
      goToLogin();
      return;
    }
    setConfirmingClose(false);
    setCloseError(
      result.kind === "error"
        ? result.message
        : "No encontramos este cobro. Vuelve a Inicio.",
    );
  }

  return (
    <>
      <ChargeView
        charge={charge}
        remainingMs={remainingMs}
        connection={connection}
        refreshing={refreshing}
        closeError={closeError}
        onRefresh={() => void refresh()}
        onRequestClose={() => {
          setCloseError(null);
          setConfirmingClose(true);
        }}
      />
      <ConfirmDialog
        open={confirmingClose && status === "waiting_payment"}
        title="¿Cerrar este cobro?"
        description="Se cerrará en CobraVoz, pero esto no cancela un pago en el banco."
        confirmLabel="Sí, cerrar cobro"
        cancelLabel="Volver"
        busy={closing}
        onConfirm={() => void closeCharge()}
        onCancel={() => setConfirmingClose(false)}
      />
    </>
  );
}
