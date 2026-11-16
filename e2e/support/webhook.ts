import {
  decodeWebhookSecret,
  signStandardWebhook,
} from "../../lib/security/standard-webhooks";

/** Secreto solo para E2E cuando el entorno no trae uno propio. No es el de producción. */
export const E2E_WEBHOOK_SECRET = `whsec_${Buffer.from("cobravoz-e2e-webhook").toString("base64")}`;

export function webhookSecret(): string {
  const configured = process.env.PEY_WEBHOOK_SECRET;
  if (configured && decodeWebhookSecret(configured)) return configured;
  return E2E_WEBHOOK_SECRET;
}

export function centsToPeyAmount(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function signedWebhook(
  body: unknown,
  webhookId = `msg_${crypto.randomUUID()}`,
) {
  const payload = JSON.stringify(body);
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const signature = signStandardWebhook({
    secret: webhookSecret(),
    webhookId,
    timestampSeconds,
    body: payload,
  });
  return {
    webhookId,
    payload,
    headers: {
      "content-type": "application/json",
      "webhook-id": webhookId,
      "webhook-timestamp": String(timestampSeconds),
      "webhook-signature": signature,
    },
  };
}
