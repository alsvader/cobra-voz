import { describe, expect, it } from "vitest";
import { REAL_QR_AMOUNT_CENTS } from "./contract";
import { createRealPeyAdapter } from "./real";

const request = {
  chargeId: "5f0d9f0e-8c3a-4e0e-9d7e-0c1f7c8c2a11",
  amountCents: 15050,
  concept: 'Cobro "CV-5F0D9F0E"',
  numRef: 1234,
  expirationSeconds: 600,
  bankAccountId: "acct-1",
};

const now = new Date("2026-11-16T06:00:00.000Z");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("cliente Pey real", () => {
  it("pide siempre $0.01 y no reintenta si Pey no confirma", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      now: () => now,
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({ message: "no" }, 500);
      },
    });

    const outcome = await pey.createCodiQr(request);

    expect(outcome).toEqual({
      status: "uncertain",
      reason: "Pey no confirmó la creación del QR (HTTP 500).",
    });
    expect(calls).toHaveLength(1);
    const body = String(calls[0].init.body);
    expect(body).toMatch(/"amount":0\.01[,}]/);
    expect(body).not.toContain("150.50");
    expect(body).not.toContain("15050");
    expect(JSON.parse(body)).toMatchObject({
      amount: 0.01,
      concept: request.concept,
      expiration: 600,
      numRef: "1234",
      generateImage: false,
      bankAccountId: "acct-1",
      metadata: { chargeId: request.chargeId },
    });
    expect(calls[0].url).toBe("https://api.pey.mx/codi/qr");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer pey-live-key",
    });
    expect(REAL_QR_AMOUNT_CENTS).toBe(1);
  });

  it("guarda el id y el qrString de una respuesta 201", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      now: () => now,
      fetch: async () =>
        jsonResponse(
          {
            id: "AB12CD34EF",
            qrString: '{"TYP":1,"IDC":"AB12CD34EF"}',
            qrImage: null,
          },
          201,
        ),
    });

    const outcome = await pey.createCodiQr(request);

    expect(outcome).toEqual({
      status: "created",
      peyQrId: "AB12CD34EF",
      qrString: '{"TYP":1,"IDC":"AB12CD34EF"}',
      expiresAt: new Date("2026-11-16T06:10:00.000Z"),
    });
  });

  it("un rechazo de Pey deja el status y el tipo de error, sin el mensaje", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () =>
        jsonResponse(
          {
            error: {
              message: "API key does not have CoDi enabled",
              type: "INVALID_STATE",
              requestId: "abc",
            },
          },
          400,
        ),
    });

    const outcome = await pey.createCodiQr(request);

    expect(outcome).toEqual({
      status: "uncertain",
      reason: "Pey no confirmó la creación del QR (HTTP 400, INVALID_STATE).",
    });
  });

  it("un cuerpo sin qrString queda incierto y no se vuelve a llamar", async () => {
    let calls = 0;
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => {
        calls += 1;
        return jsonResponse({ id: "AB12CD34EF" }, 201);
      },
    });

    const outcome = await pey.createCodiQr(request);

    expect(outcome.status).toBe("uncertain");
    expect(calls).toBe(1);
  });

  it("un timeout queda incierto", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => {
        throw new DOMException("The operation was aborted", "AbortError");
      },
    });

    const outcome = await pey.createCodiQr(request);
    expect(outcome.status).toBe("uncertain");
  });

  it("sigue nextToken y convierte el importe a centavos enteros", async () => {
    const urls: string[] = [];
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async (url) => {
        urls.push(String(url));
        if (!String(url).includes("nextToken")) {
          return jsonResponse({
            items: [
              {
                id: "tx-pending",
                status: "PENDING",
                amount: 0.01,
                currency: "MXN",
              },
              {
                id: "tx-paid",
                status: "PAID",
                amount: 0.01,
                currency: "MXN",
                datePaid: 1790724818,
              },
            ],
            nextToken: "page-2",
          });
        }
        return jsonResponse({
          items: [
            {
              id: "tx-two",
              status: "PAID",
              amount: 0.01,
              currency: "MXN",
              datePaid: 1790724900,
              numRef: "1234",
              bankAccountId: "acct-1",
            },
          ],
          nextToken: null,
        });
      },
    });

    const outcome = await pey.queryCodiQrPayments("AB12CD34EF");

    expect(urls).toEqual([
      "https://api.pey.mx/transaction/codi/qr/AB12CD34EF",
      "https://api.pey.mx/transaction/codi/qr/AB12CD34EF?nextToken=page-2",
    ]);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.payments).toEqual([
      {
        transactionId: "tx-paid",
        amountCents: 1,
        numRef: null,
        bankAccountId: null,
        paidAt: new Date(1790724818 * 1000),
      },
      {
        transactionId: "tx-two",
        amountCents: 1,
        numRef: 1234,
        bankAccountId: "acct-1",
        paidAt: new Date(1790724900 * 1000),
      },
    ]);
  });

  it("un importe que no cae en centavos deja la consulta sin acreditar", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () =>
        jsonResponse({
          items: [
            {
              id: "tx-bad",
              status: "PAID",
              amount: 10.555,
              currency: "MXN",
              datePaid: 1790724818,
            },
          ],
          nextToken: null,
        }),
    });

    const outcome = await pey.queryCodiQrPayments("AB12CD34EF");
    expect(outcome.status).toBe("unavailable");
  });

  it("si la lista no trae fecha, confirma con GET /transaction/:id", async () => {
    const urls: string[] = [];
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async (url) => {
        urls.push(String(url));
        if (String(url).includes("/transaction/codi/qr/")) {
          return jsonResponse({
            items: [
              { id: "tx-1", status: "PAID", amount: 0.01, currency: "MXN" },
            ],
            nextToken: null,
          });
        }
        return jsonResponse({
          id: "tx-1",
          status: "PAID",
          amount: 0.01,
          currency: "MXN",
          datePaid: 1790724818,
          payableType: "API_CODI_QR",
          payableId: "AB12CD34EF",
        });
      },
    });

    const outcome = await pey.queryCodiQrPayments("AB12CD34EF");

    expect(urls[1]).toBe("https://api.pey.mx/transaction/tx-1");
    expect(outcome).toMatchObject({
      status: "ok",
      payments: [{ transactionId: "tx-1", amountCents: 1 }],
    });
  });

  it("envía la notificación a /codi/pn con $0.01 y el celular", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      now: () => now,
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          transactionId: "01J5KXYZ1234567890ABCD",
          codiId: "12345678901234567890",
        });
      },
    });

    const outcome = await pey.createCodiPush({
      ...request,
      phoneNumber: "5512345678",
    });

    expect(outcome).toMatchObject({
      status: "created",
      transactionId: "01J5KXYZ1234567890ABCD",
      codiId: "12345678901234567890",
    });
    expect(calls[0].url).toBe("https://api.pey.mx/codi/pn");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      amount: 0.01,
      phoneNumber: "5512345678",
      numRef: "1234",
      expiration: 600,
      bankAccountId: "acct-1",
    });
    expect(body.generateImage).toBeUndefined();
    expect(String(calls[0].init.body)).not.toContain("150.50");
  });

  it("un 200 sin folio deja la notificación incierta", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => jsonResponse({ transactionId: "01J5KXYZ" }),
    });
    const outcome = await pey.createCodiPush({
      ...request,
      phoneNumber: "5512345678",
    });
    expect(outcome).toMatchObject({
      status: "uncertain",
      reason: expect.stringContaining("codiId: ausente"),
    });
    if (outcome.status === "uncertain") {
      expect(outcome.reason).not.toContain("5512345678");
    }
  });

  it("conserva un folio de 20 dígitos que Pey mandó como número", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      now: () => now,
      fetch: async () =>
        new Response(
          '{"transactionId":"01J5KXYZ1234567890ABCD","codiId":12345678901234567890}',
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    const outcome = await pey.createCodiPush({
      ...request,
      phoneNumber: "5512345678",
    });
    expect(outcome).toMatchObject({
      status: "created",
      transactionId: "01J5KXYZ1234567890ABCD",
      codiId: "12345678901234567890",
    });
  });

  it("acepta un folio de 20 caracteres con letras", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      now: () => now,
      fetch: async () =>
        jsonResponse({
          transactionId: "01J5KXYZ1234567890ABCD",
          codiId: "AB12CD34EF56GH78IJ90",
        }),
    });
    const outcome = await pey.createCodiPush({
      ...request,
      phoneNumber: "5512345678",
    });
    expect(outcome).toMatchObject({
      status: "created",
      codiId: "AB12CD34EF56GH78IJ90",
    });
  });

  it("acepta el folio con espacios y el id cuando no viene transactionId", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      now: () => now,
      fetch: async () =>
        jsonResponse({
          id: "01J5KXYZ1234567890ABCD",
          codiId: "1234 5678 9012 3456 7890",
        }),
    });
    const outcome = await pey.createCodiPush({
      ...request,
      phoneNumber: "5512345678",
    });
    expect(outcome).toMatchObject({
      status: "created",
      transactionId: "01J5KXYZ1234567890ABCD",
      codiId: "12345678901234567890",
    });
  });

  it("consulta la notificación por su transactionId", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () =>
        jsonResponse({
          id: "01J5KXYZ1234567890ABCD",
          status: "PAID",
          amount: 0.01,
          currency: "MXN",
          paymentMethod: "CODI",
          payableType: "API_CODI_PN",
          datePaid: 1790724758,
          metadata: { externalMetadata: { chargeId: request.chargeId } },
        }),
    });

    const outcome = await pey.queryCodiPushPayment("01J5KXYZ1234567890ABCD");
    expect(outcome).toMatchObject({
      status: "ok",
      chargeId: request.chargeId,
      payment: { transactionId: "01J5KXYZ1234567890ABCD", amountCents: 1 },
    });
  });

  it("un error HTTP de la consulta no se toma como «no hubo pago»", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => jsonResponse({ message: "down" }, 503),
    });

    const outcome = await pey.queryCodiQrPayments("AB12CD34EF");
    expect(outcome.status).toBe("unavailable");
  });

  it("crea el enlace con el importe capturado y las direcciones de regreso", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      now: () => now,
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          id: "01LINK",
          url: "https://app.mipey.mx/payment-link/01LINK",
        });
      },
    });

    const outcome = await pey.createPaymentLink({
      chargeId: request.chargeId,
      amountCents: 15050,
      expirationSeconds: 600,
      successUrl: "https://cobravoz.example/enlace/pago-completado",
      backUrl: "https://cobravoz.example/enlace/pago-cancelado",
    });

    expect(outcome).toMatchObject({
      status: "created",
      peyPaymentLinkId: "01LINK",
      url: "https://app.mipey.mx/payment-link/01LINK",
    });
    expect(calls[0].url).toBe("https://api.pey.mx/payment-link/create");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      amount: 150.5,
      successUrl: "https://cobravoz.example/enlace/pago-completado",
      backUrl: "https://cobravoz.example/enlace/pago-cancelado",
      hasTip: false,
      clientReferenceId: request.chargeId,
      metadata: { chargeId: request.chargeId },
    });
  });

  it("un 400 rechaza el enlace y no guarda el mensaje libre", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () =>
        jsonResponse(
          {
            error: {
              type: "INVALID_AMOUNT",
              message: "el monto secreto no sirve",
            },
          },
          400,
        ),
    });
    const outcome = await pey.createPaymentLink({
      chargeId: request.chargeId,
      amountCents: 15050,
      expirationSeconds: 600,
      successUrl: "https://cobravoz.example/enlace/pago-completado",
      backUrl: "https://cobravoz.example/enlace/pago-cancelado",
    });
    expect(outcome).toEqual({ status: "rejected", errorType: "INVALID_AMOUNT" });
    expect(JSON.stringify(outcome)).not.toContain("secreto");
  });

  it("un 500 deja el enlace incierto y no reintenta", async () => {
    let calls = 0;
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => {
        calls += 1;
        return jsonResponse(
          {
            error: {
              type: "INTERNAL_SERVER_ERROR",
              message: "falla interna secreta",
            },
          },
          500,
        );
      },
    });
    const outcome = await pey.createPaymentLink({
      chargeId: request.chargeId,
      amountCents: 15050,
      expirationSeconds: 600,
      successUrl: "https://cobravoz.example/enlace/pago-completado",
      backUrl: "https://cobravoz.example/enlace/pago-cancelado",
    });
    expect(outcome.status).toBe("uncertain");
    if (outcome.status === "uncertain") {
      expect(outcome.reason).toContain("HTTP 500");
      expect(outcome.reason).toContain("INTERNAL_SERVER_ERROR");
      expect(outcome.reason).not.toContain("secreta");
    }
    expect(calls).toBe(1);
  });

  it("un 200 incompleto deja el enlace incierto", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => jsonResponse({ id: "01LINK" }),
    });
    const outcome = await pey.createPaymentLink({
      chargeId: request.chargeId,
      amountCents: 15050,
      expirationSeconds: 600,
      successUrl: "https://cobravoz.example/enlace/pago-completado",
      backUrl: "https://cobravoz.example/enlace/pago-cancelado",
    });
    expect(outcome).toMatchObject({ status: "uncertain" });
  });

  it("no llama a Pey si las direcciones de regreso no son https", async () => {
    let calls = 0;
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => {
        calls += 1;
        return jsonResponse({});
      },
    });
    const outcome = await pey.createPaymentLink({
      chargeId: request.chargeId,
      amountCents: 15050,
      expirationSeconds: 600,
      successUrl: "http://localhost:3000/enlace/pago-completado",
      backUrl: "http://localhost:3000/enlace/pago-cancelado",
    });
    expect(outcome).toEqual({ status: "rejected", errorType: "INVALID_URL" });
    expect(calls).toBe(0);
  });

  it("consulta el enlace y separa la base de la propina", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () =>
        jsonResponse({
          id: "01LINK",
          status: "paid",
          transactions: [
            {
              transactionId: "01TX",
              amount: 118.5,
              datePaid: 1790724818,
              amountBreakdown: { base: 100, tip: 15, fee: 3.5 },
            },
          ],
        }),
    });
    const outcome = await pey.queryPaymentLink("01LINK");
    expect(outcome).toMatchObject({
      status: "ok",
      state: "paid",
      transaction: {
        transactionId: "01TX",
        amountCents: 11850,
        baseCents: 10000,
      },
    });
  });

  it("un error al consultar el enlace no se toma como pagado", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => jsonResponse({ type: "NOT_FOUND" }, 404),
    });
    const outcome = await pey.queryPaymentLink("01LINK");
    expect(outcome.status).toBe("unavailable");
  });
});
