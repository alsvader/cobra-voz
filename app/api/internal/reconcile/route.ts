import { connection } from "next/server";
import { getDb } from "@/adapters/db/client";
import { PeyNotConfiguredError, getPeyAdapter } from "@/adapters/pey";
import { reconcilePending } from "@/modules/payments/reconcile";
import { bearerMatches } from "@/lib/security/cron";
import { errorJson, privateJson } from "@/lib/security/responses";

/**
 * GET /api/internal/reconcile — pasada de conciliación (Architecture §9).
 *
 * La llama el cron de Vercel cada 5 minutos con
 * `Authorization: Bearer <CRON_SECRET>`. Sin ese secreto no hace nada.
 * No usa sesión de comerciante: el secreto es la única autenticación.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET ?? "";
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return errorJson(401, "unauthorized", "No autorizado.");
  }

  let pey;
  try {
    pey = getPeyAdapter();
  } catch (error) {
    if (error instanceof PeyNotConfiguredError) {
      return errorJson(
        503,
        "provider_not_configured",
        "La conciliación no está disponible en este entorno.",
      );
    }
    throw error;
  }

  try {
    const result = await reconcilePending({ db: getDb(), pey });
    console.info(JSON.stringify({ event: "reconciliation_run", ...result }));
    return privateJson(result);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "reconciliation_run_failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return errorJson(
      500,
      "internal_error",
      "No pudimos conciliar los cobros pendientes.",
    );
  }
}
