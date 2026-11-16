import { connection } from "next/server";
import { getDb } from "@/adapters/db/client";
import { PeyNotConfiguredError, getPeyAdapter } from "@/adapters/pey";
import { withMerchantApi } from "@/modules/identity/api";
import { chargeIdSchema } from "@/modules/charges/schemas";
import { reconcileCharge } from "@/modules/payments/reconcile";
import { errorJson, privateJson } from "@/lib/security/responses";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/charges/:id/reconcile — «Consultar nuevamente».
 *
 * Pregunta a Pey por el QR que este cobro ya tiene y aplica la misma
 * validación que el webhook. No acredita nada si Pey no responde, y no
 * consulta un cobro cuyo QR nunca se confirmó. El comercio sale de la sesión.
 */
export const POST = withMerchantApi<RouteContext>(
  async (_request, { merchantId }, { params }) => {
    await connection();
    const id = chargeIdSchema.safeParse((await params).id);
    if (!id.success) {
      return errorJson(404, "not_found", "No encontramos ese cobro.");
    }

    let pey;
    try {
      pey = getPeyAdapter();
    } catch (error) {
      if (error instanceof PeyNotConfiguredError) {
        return errorJson(
          503,
          "provider_not_configured",
          "No pudimos consultar el pago. Inténtalo de nuevo en un momento.",
        );
      }
      throw error;
    }

    try {
      const result = await reconcileCharge(
        { db: getDb(), pey },
        merchantId,
        id.data,
      );

      if (!result.ok && result.error === "not_found") {
        return errorJson(404, "not_found", "No encontramos ese cobro.");
      }
      if (!result.ok && result.error === "not_reconcilable") {
        return privateJson(
          {
            error: {
              code: "not_reconcilable",
              message:
                "Este cobro no tiene un código confirmado para consultar.",
            },
            charge: result.charge,
            serverTime: new Date().toISOString(),
          },
          { status: 409 },
        );
      }
      if (!result.ok) {
        return privateJson(
          {
            error: {
              code: "provider_unavailable",
              message:
                "No pudimos consultar el pago. Eso no significa que haya fallado.",
            },
            charge: result.charge,
            serverTime: new Date().toISOString(),
          },
          { status: 503 },
        );
      }

      return privateJson({
        charge: result.charge,
        serverTime: new Date().toISOString(),
        outcome: result.outcome,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "reconcile_charge_failed",
          error: error instanceof Error ? error.name : "unknown",
        }),
      );
      return errorJson(
        500,
        "internal_error",
        "No pudimos consultar el pago. Inténtalo de nuevo.",
      );
    }
  },
);
