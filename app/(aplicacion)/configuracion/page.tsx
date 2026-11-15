import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { getDb } from "@/adapters/db/client";
import { VoiceAnnouncementsSwitch } from "@/components/settings/voice-announcements-switch";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMerchantContext } from "@/modules/identity/guards";
import { getMerchantProfile } from "@/modules/merchant/service";
import { getPreferences } from "@/modules/preferences/service";
import { ROUTES } from "@/lib/routes";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: "Configuración",
  description: "Datos de tu comercio y preferencias de audio.",
};

export default function ConfiguracionPage() {
  return (
    <AppShell
      header={
        <PageHeader
          title="Configuración"
          backHref={ROUTES.app}
          backLabel="Volver a Inicio"
        />
      }
    >
      {/* Datos del comercio y sesión: se leen en la petición, tras Suspense. */}
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </AppShell>
  );
}

async function SettingsContent() {
  // Autoriza junto a los datos: el comercio sale de la sesión, no de la URL.
  const { merchantId } = await requireMerchantContext();
  const db = getDb();
  const [profile, preferences] = await Promise.all([
    getMerchantProfile(db, merchantId),
    getPreferences(db, merchantId),
  ]);

  return (
    <div className="flex flex-col gap-8 py-4">
      <section
        aria-labelledby="comercio"
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="comercio" className="text-lg font-semibold text-foreground">
          Tu comercio
        </h2>
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Nombre</dt>
            <dd className="text-base font-semibold text-foreground">
              {profile?.name}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              Cuenta que recibe los pagos
            </dt>
            <dd className="text-base font-semibold text-foreground">
              {profile?.receivingAccountLabel ?? "Configurada"}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Estos datos los configura CobraVoz y no se pueden cambiar desde aquí.
        </p>
      </section>

      <section
        aria-label="Preferencias"
        className="rounded-lg border border-border bg-surface p-5 shadow-card"
      >
        <VoiceAnnouncementsSwitch
          initialEnabled={preferences.voiceAnnouncementsEnabled}
        />
      </section>

      <form action={logoutAction}>
        <Button type="submit" variant="outline">
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-8 py-4" aria-hidden="true">
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-14 rounded-button" />
    </div>
  );
}
