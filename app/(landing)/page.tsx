import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    absolute: "CobraVoz",
  },
  description: "Cobra fácilmente, sin dejar de atender tu negocio.",
};

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-shell flex-1 flex-col justify-center gap-8 px-5 py-12">
      <div className="flex flex-col gap-3">
        <p className="text-lg font-bold text-foreground">CobraVoz</p>
        <h1 className="text-2xl font-bold text-foreground">
          Cobra fácilmente, sin dejar de atender tu negocio.
        </h1>
        <p className="text-base text-muted-foreground">
          Dicta el importe, confirma el cobro y muestra un QR CoDi real.
        </p>
      </div>
      <Link href="/inicio" className={cn(buttonVariants({ size: "lg" }))}>
        Entrar a la aplicación
      </Link>
    </main>
  );
}
