import { getPublicConfig } from "@/lib/config/public-env";
import { ROUTES } from "@/lib/routes";

/** Direcciones HTTPS que Pey usa para devolver al cliente. No confirman el pago. */
export function paymentLinkReturnUrls(appUrl = getPublicConfig().appUrl): {
  successUrl: string;
  backUrl: string;
} {
  const base = appUrl.replace(/\/$/, "");
  return {
    successUrl: `${base}${ROUTES.paymentLinkPaid}`,
    backUrl: `${base}${ROUTES.paymentLinkCancelled}`,
  };
}
