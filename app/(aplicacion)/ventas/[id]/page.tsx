import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { getDb } from "@/adapters/db/client";
import { movementStatus } from "@/components/sales/movement-status";
import { AppShell } from "@/components/ui/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { chargePath, ROUTES, saleOrigin } from "@/lib/routes";
import { formatMxn } from "@/modules/charges/amount";
import { chargeIdSchema } from "@/modules/charges/schemas";
import { requireMerchantContext } from "@/modules/identity/guards";
import { getMovementDetail } from "@/modules/sales/service";
import type { MovementDetail } from "@/modules/sales/types";

export const metadata: Metadata = {
  title: "Detalle",
  description: "Detalle de solo lectura de un movimiento.",
};

type Params = Promise<{ id: string }>;
type Search = Promise<{ desde?: string }>;

/**
 * A03 — Detalle. Solo lectura: no hay acción para marcar un pago. El origen
 * del «Volver» sale de `desde`, limitado a Inicio, Ventas o el cobro.
 */
export default function DetallePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DetailContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { merchantId } = await requireMerchantContext();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsed = chargeIdSchema.safeParse(id);
  const origin = saleOrigin(query.desde);
  const back =
    origin === "inicio"
      ? { href: ROUTES.app, label: "Volver a Inicio" }
      : origin === "cobro" && parsed.success
        ? { href: chargePath(parsed.data), label: "Volver al cobro" }
        : { href: ROUTES.sales, label: "Volver a Ventas" };

  const detail = parsed.success
    ? await getMovementDetail({ db: getDb() }, merchantId, parsed.data)
    : null;

  return (
    <AppShell
      header={
        <PageHeader
          title="Detalle"
          backHref={back.href}
          backLabel={back.label}
        />
      }
    >
      {detail ? (
        <DetailBody detail={detail} />
      ) : (
        <EmptyState
          icon={SearchX}
          title="No encontramos ese movimiento"
          description="Puede que el enlace sea incorrecto. Vuelve a Ventas para continuar."
          action={
            <Link
              href={ROUTES.sales}
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              Volver a Ventas
            </Link>
          }
        />
      )}
    </AppShell>
  );
}

function DetailBody({ detail }: { detail: MovementDetail }) {
  const status = movementStatus(detail.status);
  const rows: Array<[string, string]> = [
    ["Importe solicitado", formatMxn(detail.requestedCents)],
  ];
  if (detail.receivedCents !== null) {
    rows.push(["Importe recibido", formatMxn(detail.receivedCents)]);
  }
  rows.push(["Fecha del cobro", detail.createdLabel]);
  if (detail.paidLabel) rows.push(["Fecha del pago", detail.paidLabel]);
  if (detail.recordedLabel) {
    rows.push(["Fecha de registro", detail.recordedLabel]);
  }
  rows.push(["Referencia", detail.reference], ["Método", detail.methodLabel]);

  return (
    <div className="flex flex-col gap-5 py-4">
      <StatusBadge
        tone={status.tone}
        label={status.label}
        className="self-start"
      />
      <p className="text-base text-foreground">{detail.explanation}</p>
      <dl className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 px-4 py-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-base font-semibold tabular-nums text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <AppShell
      header={
        <PageHeader
          title="Detalle"
          backHref={ROUTES.sales}
          backLabel="Volver a Ventas"
        />
      }
    >
      <div className="flex flex-col gap-5 py-4" aria-hidden="true">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </AppShell>
  );
}
