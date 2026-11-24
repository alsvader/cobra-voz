import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Keyboard, QrCode, Settings } from "lucide-react";
import { getDb } from "@/adapters/db/client";
import { AppShell } from "@/components/ui/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingChargeNotice } from "@/components/charge/pending-charge-notice";
import { VoiceCapture } from "@/components/charge/voice-capture";
import { AllSalesLink } from "@/components/sales/all-sales-link";
import { AppNav } from "@/components/sales/app-nav";
import { DailySummary } from "@/components/sales/daily-summary";
import { MovementHistory } from "@/components/sales/movement-history";
import { RefreshOnShow } from "@/components/sales/refresh-on-show";
import { findResumableCharge } from "@/modules/charges/service";
import { requireMerchantContext } from "@/modules/identity/guards";
import { getMerchantProfile } from "@/modules/merchant/service";
import { getDailySummary, listRecentMovements } from "@/modules/sales/service";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Cobra con la voz y consulta tus ventas.",
};

export default function InicioPage() {
  return (
    <AppShell bottomNav={<AppNav current="inicio" />}>
      {/* El contenido depende de la sesión: se resuelve en la petición, tras Suspense. */}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </AppShell>
  );
}

async function HomeContent() {
  const { merchantId } = await requireMerchantContext();
  const db = getDb();
  const [profile, pending, summary, recent] = await Promise.all([
    getMerchantProfile(db, merchantId),
    findResumableCharge({ db }, merchantId),
    getDailySummary({ db }, merchantId),
    listRecentMovements({ db }, merchantId),
  ]);

  return (
    <>
      <RefreshOnShow />
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

      {/* P01: la voz es la acción dominante; la captura manual siempre está a mano. */}
      <h1 className="sr-only">Inicio</h1>
      <section
        aria-label="Cobrar"
        className="flex flex-col items-center gap-6 py-8"
      >
        <VoiceCapture enabled={Boolean(process.env.OPENAI_API_KEY?.trim())} />

        <Link
          href={ROUTES.confirmAmount}
          className={cn(
            buttonVariants({ variant: "outline", size: "md" }),
            "w-full",
          )}
        >
          <Keyboard aria-hidden="true" />
          Ingresar importe manualmente
        </Link>
        <Link
          href={ROUTES.counter}
          className={cn(
            buttonVariants({ variant: "secondary", size: "md" }),
            "w-full",
          )}
        >
          <QrCode aria-hidden="true" />
          QR del mostrador
        </Link>

        {pending ? <PendingChargeNotice charge={pending} /> : null}
      </section>

      <section aria-label="Hoy" className="flex flex-col gap-4 pb-4">
        <DailySummary
          variant="compact"
          totalCents={summary.totalCents}
          count={summary.count}
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Movimientos recientes
            </h2>
            {recent.nextCursor ? <AllSalesLink /> : null}
          </div>
          <MovementHistory
            variant="recent"
            from="inicio"
            initial={recent.movements}
            nextCursor={recent.nextCursor}
          />
        </div>
      </section>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-4" aria-hidden="true">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mx-auto size-28 rounded-full" />
      <Skeleton className="h-14 rounded-button" />
    </div>
  );
}
