import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Cobra con la voz y consulta tus ventas.",
};

export default function InicioPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[#107B75]">Aplicación</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#172D32]">
          Inicio
        </h1>
        <p className="text-base text-[#506369]">
          Aquí vive la aplicación del comerciante. Desde esta ruta saldrán el
          cobro, las ventas y la configuración.
        </p>
      </div>
      <Link href="/" className="text-base font-medium text-[#107B75]">
        Volver al sitio
      </Link>
    </main>
  );
}
