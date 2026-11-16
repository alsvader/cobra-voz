import { describe, expect, it } from "vitest";
import {
  WEBHOOK_TOLERANCE_SECONDS,
  signStandardWebhook,
  verifyStandardWebhook,
} from "./standard-webhooks";

const SECRET = `whsec_${Buffer.from("cobravoz-test-secret").toString("base64")}`;
const NOW = new Date("2026-11-15T18:00:00.000Z");
const TIMESTAMP = Math.floor(NOW.getTime() / 1000);
const BODY = JSON.stringify({
  type: "codi.qr.payment_received",
  amount: "10.00",
});

function headers(
  signature: string,
  overrides: { id?: string; timestamp?: string } = {},
) {
  return {
    id: overrides.id ?? "msg_test_1",
    timestamp: overrides.timestamp ?? String(TIMESTAMP),
    signature,
  };
}

describe("verifyStandardWebhook", () => {
  it("acepta una firma v1 del cuerpo exacto y dentro de la ventana", () => {
    const signature = signStandardWebhook({
      secret: SECRET,
      webhookId: "msg_test_1",
      timestampSeconds: TIMESTAMP,
      body: BODY,
    });

    expect(
      verifyStandardWebhook({
        secret: SECRET,
        headers: headers(signature),
        body: BODY,
        now: NOW,
      }),
    ).toEqual({ ok: true, webhookId: "msg_test_1" });
  });

  it("acepta si alguna de varias firmas coincide", () => {
    const signature = signStandardWebhook({
      secret: SECRET,
      webhookId: "msg_test_1",
      timestampSeconds: TIMESTAMP,
      body: BODY,
    });

    const result = verifyStandardWebhook({
      secret: SECRET,
      headers: headers(`v1,incorrecta ${signature}`),
      body: BODY,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("rechaza cuerpo alterado, otro secreto, reloj vencido y encabezados ausentes", () => {
    const signature = signStandardWebhook({
      secret: SECRET,
      webhookId: "msg_test_1",
      timestampSeconds: TIMESTAMP,
      body: BODY,
    });
    const base = {
      secret: SECRET,
      headers: headers(signature),
      body: BODY,
      now: NOW,
    };

    expect(verifyStandardWebhook({ ...base, body: `${BODY} ` }).ok).toBe(false);
    expect(
      verifyStandardWebhook({
        ...base,
        secret: `whsec_${Buffer.from("otro").toString("base64")}`,
      }).ok,
    ).toBe(false);
    expect(
      verifyStandardWebhook({
        ...base,
        now: new Date(NOW.getTime() + (WEBHOOK_TOLERANCE_SECONDS + 1) * 1000),
      }).ok,
    ).toBe(false);
    expect(
      verifyStandardWebhook({
        ...base,
        headers: { id: null, timestamp: null, signature: null },
      }).ok,
    ).toBe(false);
    expect(verifyStandardWebhook({ ...base, secret: "sin-prefijo" }).ok).toBe(
      false,
    );
  });
});
