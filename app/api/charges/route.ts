import { getDb } from "@/adapters/db/client";
import { PeyNotConfiguredError, getPeyAdapter } from "@/adapters/pey";
import { withMerchantApi } from "@/modules/identity/api";
import { createChargeSchema } from "@/modules/charges/schemas";
import { createCharge } from "@/modules/charges/service";
import { errorJson, privateJson } from "@/lib/security/responses";

/**
 * POST /api/charges — crea la intención de cobro del comercio de la sesión y
 * solicita el QR. Idempotente por `idempotencyKey`: repetir la petición
 * devuelve el mismo cobro (200) sin volver a llamar a Pey; una intención nueva
 * responde 201. El `merchantId` NUNCA viene del cuerpo.
 */
export const POST = withMerchantApi(async (request, { merchantId }) => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = createChargeSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(400, "invalid_request", "Solicitud no válida.");
  }

  // Antes de persistir nada: sin proveedor no se crea una intención huérfana.
  let pey;
  try {
    pey = getPeyAdapter();
  } catch (error) {
    if (error instanceof PeyNotConfiguredError) {
      return errorJson(
        503,
        "provider_not_configured",
        "El cobro con QR no está disponible por ahora.",
      );
    }
    throw error;
  }

  try {
    const result = await createCharge(
      { db: getDb(), pey },
      merchantId,
      parsed.data,
    );

    if (!result.ok) {
      return result.error === "idempotency_conflict"
        ? errorJson(
            409,
            "idempotency_conflict",
            "Esta solicitud ya se usó con otro importe. Inicia un cobro nuevo.",
          )
        : errorJson(
            403,
            "no_merchant",
            "Tu cuenta no tiene un comercio asignado.",
          );
    }

    return privateJson(
      { charge: result.charge, replayed: result.replayed },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "create_charge_failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return errorJson(
      500,
      "internal_error",
      "No pudimos crear el cobro. Inténtalo de nuevo en un momento.",
    );
  }
});
