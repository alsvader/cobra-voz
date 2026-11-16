import { getDb } from "@/adapters/db/client";
import { errorJson, privateJson } from "@/lib/security/responses";
import {
  decodeWebhookSecret,
  verifyStandardWebhook,
} from "@/lib/security/standard-webhooks";
import { parsePeyPaymentNotice } from "@/modules/payments/schema";
import { recordPeyPayment } from "@/modules/payments/service";

/**
 * POST /api/webhooks/pey — aviso de pago de Pey.
 *
 * Público: no hay sesión ni chequeo de Origin. La única autenticación es la
 * firma Standard Webhooks sobre el cuerpo crudo. Una firma inválida no se
 * persiste, para no quemar un `webhook-id` legítimo. El 200 sale solo después
 * de confirmar la transacción en la base.
 */
export async function POST(request: Request) {
  const secret = process.env.PEY_WEBHOOK_SECRET ?? "";
  if (!decodeWebhookSecret(secret)) {
    return errorJson(
      503,
      "webhook_not_configured",
      "La recepción de pagos no está disponible.",
    );
  }

  const body = await request.text();
  if (body.length > 65_536) {
    return errorJson(413, "payload_too_large", "El aviso es demasiado grande.");
  }

  const verified = verifyStandardWebhook({
    secret,
    body,
    headers: {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
  });
  if (!verified.ok) {
    return errorJson(401, "invalid_signature", "Firma del aviso no válida.");
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return errorJson(400, "invalid_payload", "El aviso no es un JSON válido.");
  }
  const notice = parsePeyPaymentNotice(json);
  if (!notice.ok) {
    return errorJson(
      400,
      "invalid_payload",
      "El aviso no tiene la forma esperada.",
    );
  }

  try {
    const result = await recordPeyPayment(
      { db: getDb() },
      verified.webhookId,
      notice.notice,
    );
    console.info(
      JSON.stringify({
        event: "pey_webhook_processed",
        webhookId: verified.webhookId,
        outcome: result.outcome,
        duplicate: result.duplicate,
      }),
    );
    return privateJson({ received: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "pey_webhook_failed",
        webhookId: verified.webhookId,
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return errorJson(
      500,
      "not_persisted",
      "No se pudo registrar el pago. Se puede reintentar.",
    );
  }
}
