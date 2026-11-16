import { test as plain } from "@playwright/test";
import { expect, signIn, test } from "./support/fixtures";
import { readCharges } from "./support/tenants";
import { centsToPeyAmount, signedWebhook } from "./support/webhook";

const ORIGIN = `http://localhost:${process.env.PORT ?? 3100}`;

async function createCharge(
  page: import("@playwright/test").Page,
  cents: number,
) {
  const created = await page.request.post("/api/charges", {
    headers: { Origin: ORIGIN },
    data: { amountCents: cents, idempotencyKey: crypto.randomUUID() },
  });
  expect(created.status()).toBe(201);
  return created.json();
}

test.describe("Webhook Pey → P03", () => {
  test("un aviso firmado que coincide pasa el cobro a pagado", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    const { charge } = await createCharge(page, 15050);
    const { qrs } = await readCharges(tenant.merchantId!);
    const signed = signedWebhook({
      type: "codi.qr.payment_received",
      transactionId: `tx-${crypto.randomUUID()}`,
      codiQrId: qrs[0].peyQrId,
      amount: centsToPeyAmount(15050),
      numRef: qrs[0].numRef,
      bankAccountId: tenant.peyBankAccountId,
      paidAt: new Date().toISOString(),
    });

    const response = await page.request.post("/api/webhooks/pey", {
      headers: signed.headers,
      data: signed.payload,
    });
    expect(response.status()).toBe(200);

    await page.goto(`/cobro/${charge.id}`);
    await expect(page.getByText("¡Pago recibido!")).toBeVisible();
    await expect(page.getByTestId("codi-qr")).toHaveCount(0);

    const stored = await readCharges(tenant.merchantId!);
    expect(stored.charges[0].status).toBe("paid");
    expect(stored.charges[0].paidPaymentId).not.toBeNull();
  });

  test("repetir el aviso no crea otro pago", async ({ page, tenant }) => {
    await signIn(page, tenant);
    await createCharge(page, 8000);
    const { qrs } = await readCharges(tenant.merchantId!);
    const signed = signedWebhook({
      type: "codi.qr.payment_received",
      transactionId: `tx-${crypto.randomUUID()}`,
      codiQrId: qrs[0].peyQrId,
      amount: "80.00",
      numRef: qrs[0].numRef,
      bankAccountId: tenant.peyBankAccountId,
      paidAt: new Date().toISOString(),
    });

    const first = await page.request.post("/api/webhooks/pey", {
      headers: signed.headers,
      data: signed.payload,
    });
    const second = await page.request.post("/api/webhooks/pey", {
      headers: signed.headers,
      data: signed.payload,
    });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    const { charges } = await readCharges(tenant.merchantId!);
    expect(charges).toHaveLength(1);
    expect(charges[0].status).toBe("paid");
  });

  test("un importe distinto deja incidencia y no dice pagado", async ({
    page,
    tenant,
  }) => {
    await signIn(page, tenant);
    const { charge } = await createCharge(page, 15050);
    const { qrs } = await readCharges(tenant.merchantId!);
    const signed = signedWebhook({
      type: "codi.qr.payment_received",
      transactionId: `tx-${crypto.randomUUID()}`,
      codiQrId: qrs[0].peyQrId,
      amount: "1.00",
      numRef: qrs[0].numRef,
      bankAccountId: tenant.peyBankAccountId,
      paidAt: new Date().toISOString(),
    });

    expect(
      (
        await page.request.post("/api/webhooks/pey", {
          headers: signed.headers,
          data: signed.payload,
        })
      ).status(),
    ).toBe(200);

    await page.goto(`/cobro/${charge.id}`);
    await expect(page.getByText("Incidencia")).toBeVisible();
    await expect(page.getByText("¡Pago recibido!")).toHaveCount(0);
    const stored = await readCharges(tenant.merchantId!);
    expect(stored.charges[0].status).toBe("incident");
    expect(
      stored.incidents.some((item) => item.type === "amount_mismatch"),
    ).toBe(true);
  });
});

plain(
  "sin firma válida responde 401 y no registra un pago",
  async ({ request }) => {
    const response = await request.post("/api/webhooks/pey", {
      headers: {
        "content-type": "application/json",
        "webhook-id": "msg_sin_firma",
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": "v1,incorrecta",
      },
      data: JSON.stringify({ type: "codi.qr.payment_received" }),
    });

    expect(response.status()).toBe(401);
  },
);
