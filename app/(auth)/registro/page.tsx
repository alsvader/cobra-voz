import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { AppShell } from "@/components/ui/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveMerchantContext } from "@/modules/identity/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Crear comercio",
  description: "Crea tu comercio en CobraVoz con correo y contraseña.",
};

export default function RegistroPage() {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-bold text-foreground">CobraVoz</p>
          <h1 className="text-xl font-semibold text-foreground">
            Crear comercio
          </h1>
          <p className="text-base text-muted-foreground">
            Entras de inmediato. No enviamos un correo de verificación.
          </p>
        </div>

        <Suspense fallback={<FormSkeleton />}>
          <RegistroContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function RegistroContent() {
  const session = await resolveMerchantContext();
  if (session.status === "ok") redirect(ROUTES.app);

  return (
    <div className="flex flex-col gap-5">
      <RegisterForm />
      <p className="text-center text-base text-muted-foreground">
        <Link
          href={ROUTES.login}
          className="font-semibold text-foreground underline"
        >
          Ya tengo cuenta
        </Link>
      </p>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-14 rounded-button" />
    </div>
  );
}
