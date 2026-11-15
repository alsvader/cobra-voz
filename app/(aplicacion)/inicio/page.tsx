import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/ui/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Cobra con la voz y consulta tus ventas.",
};

export default function InicioPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">Inicio</h1>
          <p className="text-base text-muted-foreground">
            Aquí vive la aplicación del comerciante. Desde esta ruta saldrán el
            cobro, las ventas y la configuración.
          </p>
        </div>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "md" }),
            "self-start",
          )}
        >
          Volver al sitio
        </Link>
      </div>
    </AppShell>
  );
}
