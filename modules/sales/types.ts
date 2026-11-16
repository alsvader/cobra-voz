import type { ChargeStatus } from "@/modules/charges/types";

/** Fila del historial. El importe es el solicitado; no implica que esté pagado. */
export type MovementDto = {
  id: string;
  reference: string;
  status: ChargeStatus;
  amountCents: number;
  /** Instante que ordena la fila: `paid_at` si está conciliado, si no la creación. */
  occurredAt: string;
  occurredLabel: string;
};

export type MovementPage = {
  movements: MovementDto[];
  nextCursor: string | null;
};

/** A03. Solo lectura. `receivedCents` existe únicamente con un pago conciliado. */
export type MovementDetail = {
  id: string;
  reference: string;
  status: ChargeStatus;
  requestedCents: number;
  receivedCents: number | null;
  createdLabel: string;
  paidLabel: string | null;
  recordedLabel: string | null;
  explanation: string;
};

export type DailySummary = {
  totalCents: number;
  count: number;
};
