import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { AppShell } from "@/components/ui/app-shell";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = {
  title: "Pago no enviado",
  description:
    "Regresaste sin completar el pago. El comercio sigue esperando la confirmación del banco.",
};

export default function PaymentLinkCancelledPage() {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <Logo className="h-16" />
        <Notice tone="warning" label="Pago no enviado">
          Regresaste sin completar el pago. El comercio sigue esperando. Si el
          enlace sigue vigente, puedes volver a abrirlo desde el mensaje donde
          te lo compartieron.
        </Notice>
      </div>
    </AppShell>
  );
}
