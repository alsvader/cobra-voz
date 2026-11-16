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

    expect(outcome.status).toBe("uncertain");
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

  it("un error HTTP de la consulta no se toma como «no hubo pago»", async () => {
    const pey = createRealPeyAdapter({
      apiKey: "pey-live-key",
      fetch: async () => jsonResponse({ message: "down" }, 503),
    });

    const outcome = await pey.queryCodiQrPayments("AB12CD34EF");
    expect(outcome.status).toBe("unavailable");
  });
});
