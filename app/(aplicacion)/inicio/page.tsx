import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { getDb } from "@/adapters/db/client";
import { AppShell } from "@/components/ui/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMerchantContext } from "@/modules/identity/guards";
import { getMerchantProfile } from "@/modules/merchant/service";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Cobra con la voz y consulta tus ventas.",
};

export default function InicioPage() {
  return (
    <AppShell>
      {/* El contenido depende de la sesión: se resuelve en la petición, tras Suspense. */}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </AppShell>
  );
}

async function HomeContent() {
  const { merchantId } = await requireMerchantContext();
  const profile = await getMerchantProfile(getDb(), merchantId);

  return (
    <>
      <header className="-mx-4 flex min-h-16 items-center justify-between gap-2 px-4 min-[360px]:-mx-5 min-[360px]:px-5">
        <p className="truncate text-xl font-bold text-foreground">
          {profile?.name}
        </p>
        <Link
          href={ROUTES.settings}
          aria-label="Configuración"
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted"
        >
          <Settings aria-hidden="true" className="size-5" />
        </Link>
      </header>

      <div className="flex flex-col gap-2 py-6">
        <h1 className="text-2xl font-bold text-foreground">Inicio</h1>
        <p className="text-base text-muted-foreground">
          Aquí aparecerán el cobro por voz, el resumen del día y tus
          movimientos.
        </p>
      </div>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-4" aria-hidden="true">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
  );
}
