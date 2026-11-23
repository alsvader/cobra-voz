import { getDb } from "@/adapters/db/client";
import { PeyNotConfiguredError, getPeyAdapter } from "@/adapters/pey";
import { errorJson, privateJson } from "@/lib/security/responses";
import { isLocalCounterTestAllowed } from "@/modules/counter/local-test";
import { simulateCounterPayment } from "@/modules/counter/service";
import { withMerchantApi } from "@/modules/identity/api";

/**
 * POST /api/counter-qr/test-payment — registra un pago de prueba del QR de
 * mostrador. Solo existe en local: fuera de ahí responde como si la ruta
 * no estuviera. El comercio sale de la sesión.
 */
export const POST = withMerchantApi(async (_request, { merchantId }) => {
  if (!isLocalCounterTestAllowed()) {
    return errorJson(404, "not_found", "No encontrado.");
  }

  let pey;
  try {
    pey = getPeyAdapter();
  } catch (error) {
    if (error instanceof PeyNotConfiguredError) {
      return errorJson(404, "not_found", "No encontrado.");
    }
    throw error;
  }

  const result = await simulateCounterPayment({ db: getDb(), pey }, merchantId);
  if (result.status !== "paid") {
    return errorJson(
      409,
      "test_payment_unavailable",
      "No se pudo registrar el pago de prueba.",
    );
  }
  return privateJson({ payment: result.payment }, { status: 201 });
});
