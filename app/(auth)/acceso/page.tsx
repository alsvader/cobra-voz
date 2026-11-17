import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { LOGIN_REASON_MESSAGES } from "@/modules/identity/login-errors";
import { resolveMerchantContext } from "@/modules/identity/session";
import { ROUTES, sanitizeNextPath } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accede a CobraVoz para cobrar con la voz.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AccesoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-bold text-foreground">CobraVoz</p>
          <h1 className="text-xl font-semibold text-foreground">
            Iniciar sesión
          </h1>
          <p className="text-base text-muted-foreground">
            Cobra fácilmente, sin dejar de atender tu negocio.
          </p>
        </div>

        {/* La sesión y los parámetros se leen en la petición: van tras Suspense. */}
        <Suspense fallback={<FormSkeleton />}>
          <AccesoContent searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function AccesoContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const reason = first(params.motivo);
  const next = sanitizeNextPath(first(params.siguiente)) ?? undefined;

  // Quien ya tiene sesión y comercio no necesita ver el formulario.
  const session = await resolveMerchantContext();
  if (session.status === "ok") {
    redirect(next ?? ROUTES.app);
  }

  const notice =
    reason === "sesion-expirada" || reason === "sin-comercio"
      ? LOGIN_REASON_MESSAGES[reason]
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <LoginForm next={next} notice={notice} />
      <p className="text-center text-base text-muted-foreground">
        <Link
          href={ROUTES.register}
          className="font-semibold text-foreground underline"
        >
          Crear comercio
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
      <Skeleton className="h-14 rounded-button" />
    </div>
  );
}
