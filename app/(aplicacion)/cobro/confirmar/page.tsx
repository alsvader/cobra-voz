import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmAmountScreen } from "@/components/charge/confirm-amount-screen";
import { requireMerchantContext } from "@/modules/identity/guards";
import { parseCentsParam } from "@/modules/charges/amount";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Confirmar importe",
  description: "Revisa el importe antes de generar el cobro.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * P02 — Confirmación del importe. Sin barra inferior (UX §2).
 * `?centavos=15050` precarga un importe ya conocido (p. ej. de voz); sin ese
 * parámetro, o si es inválido, abre la captura manual vacía. El valor se vuelve
 * a validar aquí: nunca se confía en lo que trae la URL.
 */
export default function ConfirmarImportePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AppShell
      header={
        <PageHeader
          title="Confirmar importe"
          backHref={ROUTES.app}
          backLabel="Volver a Inicio"
        />
      }
    >
      <Suspense fallback={<ConfirmSkeleton />}>
        <ConfirmContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function ConfirmContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Autoriza la pantalla con la sesión real, no solo con el chequeo del proxy.
  await requireMerchantContext();

  const params = await searchParams;
  const raw = Array.isArray(params.centavos)
    ? params.centavos[0]
    : params.centavos;

  const initialCents = parseCentsParam(raw);

  return (
    <ConfirmAmountScreen
      key={initialCents ?? "manual"}
      initialCents={initialCents}
    />
  );
}

function ConfirmSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-4" aria-hidden="true">
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-14 rounded-button" />
    </div>
  );
}
