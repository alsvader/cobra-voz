import { getDb } from "@/adapters/db/client";
import { withMerchantApi } from "@/modules/identity/api";
import { getDailySummary } from "@/modules/sales/service";
import { errorJson, privateJson } from "@/lib/security/responses";

/**
 * GET /api/sales/summary — total y número de pagos conciliados del día
 * comercial del comercio. Pendientes e incidencias no entran.
 */
export const GET = withMerchantApi(async (_request, { merchantId }) => {
  try {
    const summary = await getDailySummary({ db: getDb() }, merchantId);
    return privateJson(summary);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "sales_summary_failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return errorJson(
      500,
      "internal_error",
      "No pudimos consultar el total de hoy.",
    );
  }
});
