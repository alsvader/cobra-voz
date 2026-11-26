import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/adapters/db/client";
import { AppNav } from "@/components/sales/app-nav";
import { DailySummary } from "@/components/sales/daily-summary";
import { MovementHistory } from "@/components/sales/movement-history";
import { MovementStatusFilter } from "@/components/sales/movement-status-filter";
import { RefreshOnShow } from "@/components/sales/refresh-on-show";
import { AppShell } from "@/components/ui/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMerchantContext } from "@/modules/identity/guards";
import { parseMovementStatus } from "@/modules/sales/filter";
import { getDailySummary, listMovements } from "@/modules/sales/service";

export const metadata: Metadata = {
  title: "Ventas",
  description: "Total de hoy e historial de movimientos.",
};

type Search = Promise<{ estado?: string }>;

export default function VentasPage({ searchParams }: { searchParams: Search }) {
  return (
    <AppShell bottomNav={<AppNav current="ventas" />}>
      <Suspense fallback={<SalesSkeleton />}>
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function SalesContent({ searchParams }: { searchParams: Search }) {
  const { merchantId } = await requireMerchantContext();
  const status = parseMovementStatus((await searchParams).estado);
  const db = getDb();
  const [summary, page] = await Promise.all([
    getDailySummary({ db }, merchantId),
    listMovements({ db }, merchantId, { status }),
  ]);
  const history = page.ok ? page : { movements: [], nextCursor: null };

  return (
    <div className="flex flex-col gap-6 py-4">
      <RefreshOnShow />
      <h1 className="text-xl font-bold text-foreground">Ventas</h1>
      <DailySummary
        variant="full"
        totalCents={summary.totalCents}
        count={summary.count}
      />
      <section aria-label="Movimientos" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Movimientos</h2>
        <MovementStatusFilter status={status} />
        <MovementHistory
          key={status ?? "todos"}
          variant="history"
          from="ventas"
          status={status}
          initial={history.movements}
          nextCursor={history.nextCursor}
        />
      </section>
    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-4" aria-hidden="true">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-16 rounded-md" />
      <Skeleton className="h-16 rounded-md" />
    </div>
  );
}
