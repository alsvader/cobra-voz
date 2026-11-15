import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { getDb } from "@/adapters/db/client";
import { ChargeScreen } from "@/components/charge/charge-screen";
import { AppShell } from "@/components/ui/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/lib/routes";
import { serverNowMs } from "@/lib/server-time";
import { requireMerchantContext } from "@/modules/identity/guards";
import { chargeIdSchema } from "@/modules/charges/schemas";
import { getCharge } from "@/modules/charges/service";

export const metadata: Metadata = {
  title: "Cobro CoDi",
  description: "Estado del cobro y código QR para recibir el pago.",
};

type Params = Promise<{ id: string }>;

/**
 * P03 — Cobro CoDi. Una sola pantalla con estados dinámicos y sin barra
 * inferior (UX §2). El cobro se lee en el servidor, acotado al comercio de la
 * sesión: uno ajeno o inexistente se ve igual («No encontramos ese cobro»).
 */
export default function CobroPage({ params }: { params: Params }) {
  return (
    <AppShell
      header={
        <PageHeader
          title="Cobro CoDi"
          backHref={ROUTES.app}
          backLabel="Volver a Inicio"
        />
      }
    >
      <Suspense fallback={<ChargeSkeleton />}>
        <ChargeContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function ChargeContent({ params }: { params: Params }) {
  // Autoriza con la sesión real y toma el comercio DE LA SESIÓN, no de la URL.
  const { merchantId } = await requireMerchantContext();

  const id = chargeIdSchema.safeParse((await params).id);
  const charge = id.success
    ? await getCharge({ db: getDb() }, merchantId, id.data)
    : null;

  if (!charge) {
    return (
      <EmptyState
        icon={SearchX}
        title="No encontramos ese cobro"
        description="Puede que el enlace sea incorrecto. Vuelve a Inicio para continuar."
        action={
          <Link
            href={ROUTES.app}
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            Volver a Inicio
          </Link>
        }
      />
    );
  }

  return <ChargeScreen initialCharge={charge} serverTime={serverNowMs()} />;
}

function ChargeSkeleton() {
  return (
    <div className="flex flex-col gap-5 py-4" aria-hidden="true">
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="mx-auto aspect-square w-58 rounded-lg min-[360px]:w-62" />
    </div>
  );
}
