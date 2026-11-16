import { getDb } from "@/adapters/db/client";
import { withMerchantApi } from "@/modules/identity/api";
import { listMovements } from "@/modules/sales/service";
import { errorJson, privateJson } from "@/lib/security/responses";

/**
 * GET /api/sales — historial paginado del comercio de la sesión, del más
 * reciente al más antiguo. El cursor viene de la respuesta anterior.
 */
export const GET = withMerchantApi(async (request, { merchantId }) => {
  const cursor = new URL(request.url).searchParams.get("cursor");
  try {
    const page = await listMovements({ db: getDb() }, merchantId, { cursor });
    if (!page.ok) {
      return errorJson(400, "invalid_cursor", "No pudimos continuar el historial.");
    }
    return privateJson({
      movements: page.movements,
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "list_sales_failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return errorJson(
      500,
      "internal_error",
      "No pudimos consultar tus movimientos.",
    );
  }
});
