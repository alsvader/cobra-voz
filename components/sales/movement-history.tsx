"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { TransactionRow } from "@/components/sales/transaction-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import type { SaleOrigin } from "@/lib/routes";
import type { ChargeStatus } from "@/modules/charges/types";
import { salesApiPath } from "@/modules/sales/filter";
import type { MovementDto } from "@/modules/sales/types";

export type MovementHistoryProps = {
  initial: MovementDto[];
  nextCursor: string | null;
  from: SaleOrigin;
  /** P01 muestra un texto breve; P04, el estado vacío completo y «cargar más». */
  variant: "recent" | "history";
  /** Estado elegido en Ventas. `null` es el historial completo. */
  status?: ChargeStatus | null;
};

/**
 * Lista de movimientos. «Cargar movimientos anteriores» pide la página
 * siguiente al servidor; un fallo no borra lo que ya se ve.
 */
export function MovementHistory({
  initial,
  nextCursor,
  from,
  variant,
  status = null,
}: MovementHistoryProps) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const snapshot = initial
    .map((movement) =>
      [
        movement.id,
        movement.status,
        movement.amountCents,
        movement.occurredAt,
      ].join(":"),
    )
    .join("|");
  const [seen, setSeen] = useState(snapshot);
  // Al volver a la ruta, el servidor manda otra lista. El estado local se
  // reemplaza aquí, no en un efecto: si no, se queda el arreglo anterior.
  if (seen !== snapshot) {
    setSeen(snapshot);
    setItems(initial);
    setCursor(nextCursor);
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(salesApiPath(cursor, status), {
        cache: "no-store",
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body = (await response.json()) as {
        movements?: MovementDto[];
        nextCursor?: string | null;
      };
      if (!body.movements) {
        setFailed(true);
        return;
      }
      setItems((current) => [...current, ...body.movements!]);
      setCursor(body.nextCursor ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    if (variant === "recent") {
      return (
        <p className="text-base text-muted-foreground">
          Aún no tienes movimientos.
        </p>
      );
    }
    if (status) {
      return (
        <EmptyState
          icon={ReceiptText}
          title="No hay cobros en este estado"
          description="Prueba con otro estado. El total de hoy solo suma los pagos confirmados."
        />
      );
    }
    return (
      <EmptyState
        icon={ReceiptText}
        title="Aún no tienes movimientos"
        description="Cuando cobres, el historial aparecerá aquí. Solo los pagos confirmados suman al total."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border">
        {items.map((movement) => (
          <TransactionRow key={movement.id} movement={movement} from={from} />
        ))}
      </ul>
      {failed ? (
        <Notice tone="warning" label="No se cargó el historial">
          No pudimos cargar movimientos anteriores. Los que ya ves siguen aquí.
        </Notice>
      ) : null}
      {variant === "history" && cursor ? (
        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => void loadMore()}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Cargar movimientos anteriores"}
        </Button>
      ) : null}
    </div>
  );
}
