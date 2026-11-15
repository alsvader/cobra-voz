import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Keyboard, Settings } from "lucide-react";
import { getDb } from "@/adapters/db/client";
import { AppShell } from "@/components/ui/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceCaptureButton } from "@/components/charge/voice-capture-button";
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

      {/* P01: la voz es la acción dominante; la captura manual siempre está a mano. */}
      <h1 className="sr-only">Inicio</h1>
      <section
        aria-label="Cobrar"
        className="flex flex-col items-center gap-6 py-8"
      >
        <VoiceCaptureButton state="unavailable" />

        <Notice tone="info" label="Voz no disponible" className="w-full">
          Por ahora la captura por voz no está disponible. Puedes cobrar
          ingresando el importe manualmente.
        </Notice>

        <Link
          href={ROUTES.confirmAmount}
          className={buttonVariants({ variant: "outline", size: "md" })}
        >
          <Keyboard aria-hidden="true" />
          Ingresar importe manualmente
        </Link>
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
