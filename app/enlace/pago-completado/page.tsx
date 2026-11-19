import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { AppShell } from "@/components/ui/app-shell";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = {
  title: "Pago enviado",
  description:
    "El banco todavía tiene que confirmar el pago. Esta página no lo marca como recibido.",
};

export default function PaymentLinkPaidPage() {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <Logo className="h-16" />
        <Notice tone="info" label="Pago enviado">
          Si el banco lo acepta, el comercio lo verá cuando reciba la
          confirmación. Esta página no marca el cobro como pagado.
        </Notice>
      </div>
    </AppShell>
  );
}
