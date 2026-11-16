import { createHmac, timingSafeEqual } from "node:crypto";

/** Ventana anti-replay de Standard Webhooks: 5 minutos hacia cada lado. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

/**
 * Secreto Standard Webhooks: prefijo `whsec_` y el resto en base64. El valor
 * vive solo en `PEY_WEBHOOK_SECRET` (servidor). Nunca en `NEXT_PUBLIC_*`.
 */
export function decodeWebhookSecret(secret: string): Buffer | null {
  if (!secret.startsWith("whsec_")) return null;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  if (key.length === 0) return null;
  return key;
}

/** Firma `v1` sobre `${id}.${timestamp}.${body}`, el cuerpo tal cual llegó. */
export function signStandardWebhook(input: {
  secret: string;
  webhookId: string;
  timestampSeconds: number;
  body: string;
}): string {
  const key = decodeWebhookSecret(input.secret);
  if (!key) {
    throw new Error("Secreto de webhook no válido.");
  }
  const signed = `${input.webhookId}.${input.timestampSeconds}.${input.body}`;
  const digest = createHmac("sha256", key).update(signed).digest("base64");
  return `v1,${digest}`;
}

function signaturesMatch(expected: string, candidate: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verifica firma y frescura. Cualquier fallo es el mismo resultado: no se
 * distingue un secreto malo de un reloj viejo, y no se persiste nada.
 */
export function verifyStandardWebhook(input: {
  secret: string;
  headers: WebhookHeaders;
  body: string;
  now?: Date;
}): { ok: true; webhookId: string } | { ok: false } {
  const key = decodeWebhookSecret(input.secret);
  const { id, timestamp, signature } = input.headers;
  if (!key || !id || !timestamp || !signature) return { ok: false };
  if (!/^[\w.-]{1,128}$/.test(id)) return { ok: false };
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false };

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false };
  }

  const expected = signStandardWebhook({
    secret: input.secret,
    webhookId: id,
    timestampSeconds,
    body: input.body,
  });
  const matches = signature
    .split(" ")
    .some((part) => signaturesMatch(expected, part));
  return matches ? { ok: true, webhookId: id } : { ok: false };
}
