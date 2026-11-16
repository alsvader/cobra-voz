import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/adapters/db/client";
import { AppNav } from "@/components/sales/app-nav";
import { DailySummary } from "@/components/sales/daily-summary";
import { MovementHistory } from "@/components/sales/movement-history";
import { AppShell } from "@/components/ui/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMerchantContext } from "@/modules/identity/guards";
import { getDailySummary, listMovements } from "@/modules/sales/service";

export const metadata: Metadata = {
  title: "Ventas",
  description: "Total de hoy e historial de movimientos.",
};

export default function VentasPage() {
  return (
    <AppShell bottomNav={<AppNav current="ventas" />}>
      <Suspense fallback={<SalesSkeleton />}>
        <SalesContent />
      </Suspense>
    </AppShell>
  );
}

async function SalesContent() {
  const { merchantId } = await requireMerchantContext();
  const db = getDb();
  const [summary, page] = await Promise.all([
    getDailySummary({ db }, merchantId),
    listMovements({ db }, merchantId),
  ]);
  const history = page.ok ? page : { movements: [], nextCursor: null };

  return (
    <div className="flex flex-col gap-6 py-4">
      <h1 className="text-xl font-bold text-foreground">Ventas</h1>
      <DailySummary
        variant="full"
        totalCents={summary.totalCents}
        count={summary.count}
      />
      <section aria-label="Movimientos" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Movimientos</h2>
        <MovementHistory
          variant="history"
          from="ventas"
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
