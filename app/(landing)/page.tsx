import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: {
    absolute: "CobraVoz | Cobra con tu voz y sigue atendiendo tu negocio",
  },
  description:
    "Di el importe, confirma la cantidad y muestra un QR CoDi para recibir el pago. CobraVoz te avisa cuando el pago está verificado.",
};

export default function Page() {
  return <LandingPage />;
}
