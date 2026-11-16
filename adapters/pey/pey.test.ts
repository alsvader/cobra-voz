import { describe, expect, it } from "vitest";
import {
  getPeyAdapter,
  isMockPeyAllowed,
  PeyNotConfiguredError,
} from "./index";
import {
  MOCK_QR_PREFIX,
  MOCK_QUERY_PAID_AMOUNT_CENTS,
  MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS,
  MOCK_UNCERTAIN_AMOUNT_CENTS,
  createMockPeyAdapter,
  isSimulatedQr,
} from "./mock";

const request = {
  chargeId: "5f0d9f0e-8c3a-4e0e-9d7e-0c1f7c8c2a11",
  amountCents: 15050,
  concept: "Cobro CV-5F0D9F0E",
  numRef: 1234,
  expirationSeconds: 600,
  bankAccountId: "acct-1",
};

describe("adaptador Pey simulado", () => {
  it("devuelve un QR rotulado como prueba y con vigencia de 600 s", async () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const mock = createMockPeyAdapter({ now: () => now });

    const outcome = await mock.createCodiQr(request);

    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") return;
    expect(outcome.peyQrId).toMatch(/^mock-qr-/);
    expect(outcome.qrString.startsWith(MOCK_QR_PREFIX)).toBe(true);
    expect(isSimulatedQr(outcome.qrString)).toBe(true);
    expect(outcome.expiresAt).toEqual(new Date("2026-11-15T12:10:00Z"));
  });

  it("el importe mágico produce un resultado incierto (sin QR)", async () => {
    const mock = createMockPeyAdapter();

    const outcome = await mock.createCodiQr({
      ...request,
      amountCents: MOCK_UNCERTAIN_AMOUNT_CENTS,
    });

    expect(outcome.status).toBe("uncertain");
    expect(outcome).not.toHaveProperty("qrString");
  });

  it("registra cada llamada (para verificar que no hay reintentos)", async () => {
    const mock = createMockPeyAdapter();
    await mock.createCodiQr(request);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].amountCents).toBe(15050);
  });

  it("consulta un QR conocido sin inventar un pago", async () => {
    const mock = createMockPeyAdapter();
    const created = await mock.createCodiQr(request);
    if (created.status !== "created") throw new Error("setup");

    const outcome = await mock.queryCodiQrPayments(created.peyQrId);

    expect(outcome).toEqual({ status: "ok", payments: [] });
    expect(mock.queryCalls).toEqual([created.peyQrId]);
  });

  it("el importe mágico de consulta devuelve un pago que coincide, y solo una vez por id", async () => {
    const paidAt = new Date("2026-11-15T18:00:00Z");
    const mock = createMockPeyAdapter({ now: () => paidAt });
    const created = await mock.createCodiQr({
      ...request,
      amountCents: MOCK_QUERY_PAID_AMOUNT_CENTS,
    });
    if (created.status !== "created") throw new Error("setup");

    const outcome = await mock.queryCodiQrPayments(created.peyQrId);

    expect(outcome).toEqual({
      status: "ok",
      payments: [
        {
          transactionId: `mock-tx-${created.peyQrId}`,
          amountCents: MOCK_QUERY_PAID_AMOUNT_CENTS,
          numRef: request.numRef,
          bankAccountId: request.bankAccountId,
          paidAt,
        },
      ],
    });
  });

  it("otro importe mágico deja la consulta sin respuesta", async () => {
    const mock = createMockPeyAdapter();
    const created = await mock.createCodiQr({
      ...request,
      amountCents: MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS,
    });
    if (created.status !== "created") throw new Error("setup");

    const outcome = await mock.queryCodiQrPayments(created.peyQrId);

    expect(outcome.status).toBe("unavailable");
  });

  it("un id que este proceso no emitió no se trata como «sin pago»", async () => {
    const mock = createMockPeyAdapter();

    const outcome = await mock.queryCodiQrPayments("qr-desconocido");

    expect(outcome.status).toBe("unavailable");
  });

  it("un QR cualquiera no se considera de prueba", () => {
    expect(isSimulatedQr("00020101021226...")).toBe(false);
  });
});

describe("getPeyAdapter — el simulador nunca llega a producción", () => {
  it.each([
    [{ NEXT_PUBLIC_APP_ENV: "local" }],
    [{ NEXT_PUBLIC_APP_ENV: "preview" }],
    [{ NEXT_PUBLIC_APP_ENV: "preview", VERCEL_ENV: "preview" }],
  ])("permite el simulador en %j", (env) => {
    expect(isMockPeyAllowed(env)).toBe(true);
    expect(getPeyAdapter(env).kind).toBe("mock");
  });

  it.each([
    [{ NEXT_PUBLIC_APP_ENV: "production" }],
    [{}],
    [{ NEXT_PUBLIC_APP_ENV: "" }],
    [{ NEXT_PUBLIC_APP_ENV: "staging" }],
    [{ NEXT_PUBLIC_APP_ENV: "LOCAL" }],
    // Aunque la variable diga local, un despliegue de producción en Vercel no.
    [{ NEXT_PUBLIC_APP_ENV: "local", VERCEL_ENV: "production" }],
    [{ NEXT_PUBLIC_APP_ENV: "preview", VERCEL_ENV: "production" }],
  ])("bloquea (falla cerrado) en %j", (env) => {
    expect(isMockPeyAllowed(env)).toBe(false);
    expect(() => getPeyAdapter(env)).toThrow(PeyNotConfiguredError);
  });

  it("en local ignora la API key y sigue con el simulador", () => {
    const env = { NEXT_PUBLIC_APP_ENV: "local", PEY_API_KEY: "pey-live-key" };
    expect(getPeyAdapter(env).kind).toBe("mock");
  });

  it("en producción, con API key, usa el cliente real", () => {
    const env = {
      NEXT_PUBLIC_APP_ENV: "production",
      VERCEL_ENV: "production",
      PEY_API_KEY: " pey-live-key ",
    };
    expect(getPeyAdapter(env).kind).toBe("real");
  });

  it("en producción, sin API key, sigue bloqueado", () => {
    const env = {
      NEXT_PUBLIC_APP_ENV: "production",
      VERCEL_ENV: "production",
      PEY_API_KEY: "  ",
    };
    expect(() => getPeyAdapter(env)).toThrow(PeyNotConfiguredError);
  });
});
