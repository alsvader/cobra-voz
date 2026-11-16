"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { TransactionRow } from "@/components/sales/transaction-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import type { SaleOrigin } from "@/lib/routes";
import type { MovementDto } from "@/modules/sales/types";

export type MovementHistoryProps = {
  initial: MovementDto[];
  nextCursor: string | null;
  from: SaleOrigin;
  /** P01 muestra un texto breve; P04, el estado vacío completo y «cargar más». */
  variant: "recent" | "history";
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
}: MovementHistoryProps) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/sales?cursor=${encodeURIComponent(cursor)}`,
        { cache: "no-store" },
      );
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
