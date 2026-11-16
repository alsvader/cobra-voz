import { describe, expect, it, vi } from "vitest";
import {
  fetchCharge,
  newIdempotencyKey,
  requestCloseCharge,
  requestReconcile,
  submitCharge,
} from "./client";
import { idempotencyKeySchema } from "./schemas";
import type { ChargeDto } from "./types";

const input = { amountCents: 15050, idempotencyKey: newIdempotencyKey() };

const charge: ChargeDto = {
  id: "5f0d9f0e-8c3a-4e0e-9d7e-0c1f7c8c2a11",
  reference: "CV-5F0D9F0E",
  amountCents: 15050,
  currency: "MXN",
  status: "waiting_payment",
  createdAt: "2026-11-15T12:00:00.000Z",
  expiresAt: "2026-11-15T12:10:00.000Z",
  closedAt: null,
  qr: {
    payload: "COBRAVOZ-MOCK|x",
    expiresAt: "2026-11-15T12:10:00.000Z",
    simulated: true,
  },
};

function respond(status: number, body?: unknown) {
  return vi.fn(async () => Response.json(body ?? {}, { status }));
}

describe("newIdempotencyKey", () => {
  it("genera claves únicas aceptadas por el servidor", () => {
    const keys = new Set(Array.from({ length: 50 }, newIdempotencyKey));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
    }
  });
});

describe("submitCharge", () => {
  it("envía importe y clave por POST JSON y nunca un merchantId", async () => {
    const fetchMock = respond(201, { charge, replayed: false });

    const result = await submitCharge(input, fetchMock as never);

    expect(result).toEqual({ kind: "ok", charge, replayed: false });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/charges");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(input);
    expect(init.body as string).not.toMatch(/merchant/i);
  });

  it("una repetición (200) se reporta como replayed", async () => {
    const result = await submitCharge(
      input,
      respond(200, { charge, replayed: true }) as never,
    );
    expect(result).toMatchObject({ kind: "ok", replayed: true });
  });

  it("401 → unauthenticated", async () => {
    expect(await submitCharge(input, respond(401) as never)).toEqual({
      kind: "unauthenticated",
    });
  });

  it.each([
    [400, /no es válido/],
    [409, /otro importe/],
    [503, /no está disponible/],
    [500, /No pudimos crear el cobro/],
    [418, /No pudimos crear el cobro/],
  ])("estado %i → mensaje claro y sin jerga", async (status, message) => {
    const result = await submitCharge(input, respond(status) as never);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(message);
      expect(result.message).not.toMatch(/HTTP|\b50\d\b|JSON|fetch/i);
    }
  });

  it("un corte de red explica que reintentar no duplica", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await submitCharge(input, failing as never);
    expect(result).toMatchObject({ kind: "error" });
    if (result.kind === "error")
      expect(result.message).toMatch(/no se duplicará/);
  });

  it("una respuesta 200 sin cobro se trata como error, no como éxito", async () => {
    const result = await submitCharge(input, respond(200, {}) as never);
    expect(result.kind).toBe("error");
  });
});

const SERVER_TIME = "2026-11-15T12:01:00.000Z";

describe("fetchCharge", () => {
  it("lee el cobro por GET sin caché y devuelve la hora del servidor", async () => {
    const fetchMock = respond(200, { charge, serverTime: SERVER_TIME });

    const result = await fetchCharge(charge.id, fetchMock as never);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/charges/${charge.id}`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result).toEqual({
      kind: "ok",
      charge,
      serverTime: Date.parse(SERVER_TIME),
    });
  });

  it("401 → sesión vencida; 404 → no encontrado", async () => {
    expect(await fetchCharge(charge.id, respond(401) as never)).toEqual({
      kind: "unauthenticated",
    });
    expect(await fetchCharge(charge.id, respond(404) as never)).toEqual({
      kind: "not_found",
    });
  });

  it("sin red, error del servidor o respuesta sin cobro = verificación no disponible", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchCharge(charge.id, failing as never)).toEqual({
      kind: "unavailable",
    });
    expect(await fetchCharge(charge.id, respond(500) as never)).toEqual({
      kind: "unavailable",
    });
    expect(await fetchCharge(charge.id, respond(200, {}) as never)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("requestReconcile", () => {
  it("consulta por POST y devuelve el cobro persistido", async () => {
    const paid = { ...charge, status: "paid" as const };
    const fetchMock = respond(200, {
      charge: paid,
      serverTime: SERVER_TIME,
      outcome: "paid",
    });

    const result = await requestReconcile(charge.id, fetchMock as never);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/charges/${charge.id}/reconcile`,
      { method: "POST" },
    );
    expect(result).toMatchObject({ kind: "ok", charge: paid });
  });

  it("503 con cobro es verificación no disponible, sin tomarlo por pagado", async () => {
    const result = await requestReconcile(
      charge.id,
      respond(503, {
        error: { code: "provider_unavailable" },
        charge,
        serverTime: SERVER_TIME,
      }) as never,
    );
    expect(result).toMatchObject({
      kind: "unavailable",
      charge,
    });
  });

  it("401 y un fallo de red no confirman el pago", async () => {
    expect(await requestReconcile(charge.id, respond(401) as never)).toEqual({
      kind: "unauthenticated",
    });
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await requestReconcile(charge.id, failing as never)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("requestCloseCharge", () => {
  it("cierra por POST sin cuerpo y devuelve el cobro del servidor", async () => {
    const closed = { ...charge, status: "locally_closed" as const };
    const fetchMock = respond(200, { charge: closed, serverTime: SERVER_TIME });

    const result = await requestCloseCharge(charge.id, fetchMock as never);

    expect(fetchMock).toHaveBeenCalledWith(`/api/charges/${charge.id}/close`, {
      method: "POST",
    });
    expect(result).toMatchObject({ kind: "ok", charge: closed });
  });

  it("409 devuelve el estado real (p. ej. pagado) en lugar de un error", async () => {
    const paid = { ...charge, status: "paid" as const };
    const result = await requestCloseCharge(
      charge.id,
      respond(409, { error: { code: "not_closable" }, charge: paid }) as never,
    );
    expect(result).toMatchObject({ kind: "not_closable", charge: paid });
  });

  it("401, 404 y fallos de red/servidor se distinguen y no se toman por cierre", async () => {
    expect(await requestCloseCharge(charge.id, respond(401) as never)).toEqual({
      kind: "unauthenticated",
    });
    expect(await requestCloseCharge(charge.id, respond(404) as never)).toEqual({
      kind: "not_found",
    });
    for (const fetchImpl of [
      respond(500),
      respond(200, {}),
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ]) {
      const result = await requestCloseCharge(charge.id, fetchImpl as never);
      expect(result.kind).toBe("error");
    }
  });
});
