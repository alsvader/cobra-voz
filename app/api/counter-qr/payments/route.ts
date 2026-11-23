import { getDb } from "@/adapters/db/client";
import { privateJson } from "@/lib/security/responses";
import { listCounterPayments } from "@/modules/counter/service";
import { withMerchantApi } from "@/modules/identity/api";

/** Pagos recientes del QR de mostrador. La pantalla los consulta cada pocos segundos. */
export const GET = withMerchantApi(async (_request, { merchantId }) => {
  const payments = await listCounterPayments(getDb(), merchantId);
  return privateJson({ payments });
});
