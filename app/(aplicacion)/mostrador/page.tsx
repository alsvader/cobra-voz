import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/adapters/db/client";
import { PeyNotConfiguredError, getPeyAdapter } from "@/adapters/pey";
import { CounterScreen } from "@/components/counter/counter-screen";
import { AppShell } from "@/components/ui/app-shell";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/lib/routes";
import { isLocalCounterTestAllowed } from "@/modules/counter/local-test";
import {
  ensureCounterQr,
  listCounterPayments,
} from "@/modules/counter/service";
import { requireMerchantContext } from "@/modules/identity/guards";
import { getMerchantProfile } from "@/modules/merchant/service";

export const metadata: Metadata = {
  title: "QR del mostrador",
  description: "Código fijo para que el cliente escriba el importe y pague.",
};

export default function MostradorPage() {
  return (
    <Suspense fallback={<MostradorSkeleton />}>
      <MostradorContent />
    </Suspense>
  );
}

async function MostradorContent() {
  const { merchantId } = await requireMerchantContext();
  const db = getDb();
  const profile = await getMerchantProfile(db, merchantId);

  let qr;
  try {
    qr = await ensureCounterQr({ db, pey: getPeyAdapter() }, merchantId);
  } catch (error) {
    qr =
      error instanceof PeyNotConfiguredError
        ? { status: "not_configured" as const }
        : null;
  }

  const payments =
    qr?.status === "ready" ? await listCounterPayments(db, merchantId) : [];

  return (
    <AppShell
      header={
        <div className="print:hidden">
          <PageHeader
            title="QR del mostrador"
            backHref={ROUTES.app}
            backLabel="Volver a Inicio"
          />
        </div>
      }
    >
      {qr?.status === "ready" ? (
        <CounterScreen
          merchantName={profile?.name ?? "Tu comercio"}
          payload={qr.payload}
          simulated={qr.simulated}
          initialPayments={payments}
          allowTestPayment={isLocalCounterTestAllowed() && qr.simulated}
        />
      ) : (
        <div className="py-4">
          <Notice
            tone={qr?.status === "pending" ? "info" : "incident"}
            label={noticeLabel(qr?.status)}
          >
            {noticeCopy(qr?.status)}
          </Notice>
        </div>
      )}
    </AppShell>
  );
}

function noticeLabel(status: string | undefined): string {
  if (status === "pending") return "Preparando el QR";
  if (status === "not_configured") return "QR no disponible";
  return "No pudimos confirmar el QR";
}

function noticeCopy(status: string | undefined): string {
  if (status === "pending") {
    return "Estamos pidiendo el código. Vuelve a abrir esta pantalla en un momento.";
  }
  if (status === "not_configured") {
    return "El cobro con QR no está disponible por ahora.";
  }
  if (status === "missing_account") {
    return "Este comercio no tiene una cuenta receptora. No se pidió un código.";
  }
  return "No sabemos si se creó el código del mostrador. No pediremos otro.";
}

function MostradorSkeleton() {
  return (
    <AppShell
      header={
        <PageHeader
          title="QR del mostrador"
          backHref={ROUTES.app}
          backLabel="Volver a Inicio"
        />
      }
    >
      <div className="flex flex-col items-center gap-4 py-6" aria-hidden="true">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="size-62 rounded-lg" />
        <Skeleton className="h-24 w-full" />
      </div>
    </AppShell>
  );
}
