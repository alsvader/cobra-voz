import { getDb } from "@/adapters/db/client";
import { withMerchantApi } from "@/modules/identity/api";
import { chargeIdSchema } from "@/modules/charges/schemas";
import { getCharge } from "@/modules/charges/service";
import { errorJson, privateJson } from "@/lib/security/responses";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/charges/:id — estado actual del cobro, con QR si existe. Solo del
 * comercio de la sesión: un cobro ajeno responde 404, igual que uno inexistente.
 */
export const GET = withMerchantApi<RouteContext>(
  async (_request, { merchantId }, { params }) => {
    const id = chargeIdSchema.safeParse((await params).id);
    if (!id.success) {
      return errorJson(404, "not_found", "No encontramos ese cobro.");
    }

    const charge = await getCharge({ db: getDb() }, merchantId, id.data);
    if (!charge) {
      return errorJson(404, "not_found", "No encontramos ese cobro.");
    }
    return privateJson({ charge });
  },
);
