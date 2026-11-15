import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    absolute: "CobraVoz",
  },
  description: "Cobra fácilmente, sin dejar de atender tu negocio.",
};

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-[#107B75]">
          CobraVoz
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-[#172D32]">
          Cobra fácilmente, sin dejar de atender tu negocio.
        </h1>
        <p className="max-w-xl text-lg text-[#506369]">
          Dicta el importe, confirma el cobro y muestra un QR CoDi real.
        </p>
      </div>
      <Link
        href="/inicio"
        className="inline-flex h-12 w-fit items-center rounded-full bg-[#107B75] px-5 text-base font-medium text-white"
      >
        Entrar a la aplicación
      </Link>
    </main>
  );
}
