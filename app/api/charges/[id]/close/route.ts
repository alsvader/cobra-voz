import { getDb } from "@/adapters/db/client";
import { withMerchantApi } from "@/modules/identity/api";
import { chargeIdSchema } from "@/modules/charges/schemas";
import { closeCharge } from "@/modules/charges/service";
import { errorJson, privateJson } from "@/lib/security/responses";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/charges/:id/close — «Cerrar cobro»: cierre LOCAL de un cobro que
 * espera pago. No cancela nada en el banco ni impide conciliar un pago tardío.
 *
 *  - 200: cerrado (o ya lo estaba: idempotente).
 *  - 404: no existe o es de otro comercio.
 *  - 409: el cobro ya no se puede cerrar (pagado, vencido...); devuelve el
 *    estado real para que la pantalla se corrija.
 *
 * Sin cuerpo: el comercio sale de la sesión y el destino, de la URL.
 */
export const POST = withMerchantApi<RouteContext>(
  async (_request, { merchantId }, { params }) => {
    const id = chargeIdSchema.safeParse((await params).id);
    if (!id.success) {
      return errorJson(404, "not_found", "No encontramos ese cobro.");
    }

    try {
      const result = await closeCharge({ db: getDb() }, merchantId, id.data);

      if (result.ok) {
        return privateJson({
          charge: result.charge,
          serverTime: new Date().toISOString(),
        });
      }
      if (result.error === "not_found") {
        return errorJson(404, "not_found", "No encontramos ese cobro.");
      }
      return privateJson(
        {
          error: {
            code: "not_closable",
            message: "Este cobro ya no se puede cerrar.",
          },
          charge: result.charge,
          serverTime: new Date().toISOString(),
        },
        { status: 409 },
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "close_charge_failed",
          error: error instanceof Error ? error.name : "unknown",
        }),
      );
      return errorJson(
        500,
        "internal_error",
        "No pudimos cerrar el cobro. Inténtalo de nuevo.",
      );
    }
  },
);
