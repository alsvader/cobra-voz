import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmAmountScreen } from "@/components/charge/confirm-amount-screen";
import { requireMerchantContext } from "@/modules/identity/guards";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Confirmar importe",
  description: "Revisa el importe antes de generar el cobro.",
};

/**
 * P02 — Confirmación del importe. Sin barra inferior (UX §2).
 * `?centavos=15050` precarga un importe ya conocido (p. ej. de voz) y `?frase=`
 * muestra lo que se escuchó. Sin un importe válido, abre la captura manual
 * vacía. El valor lo lee la pantalla desde la URL actual: la ruta puede
 * quedar montada y no debe conservar el cobro anterior.
 */
export default function ConfirmarImportePage() {
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
        <ConfirmContent />
      </Suspense>
    </AppShell>
  );
}

async function ConfirmContent() {
  // Autoriza la pantalla con la sesión real, no solo con el chequeo del proxy.
  await requireMerchantContext();
  return <ConfirmAmountScreen />;
}

function ConfirmSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-4" aria-hidden="true">
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-14 rounded-button" />
    </div>
  );
}
