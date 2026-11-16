import type { ChargeDto } from "./types";

/** Clave de idempotencia para UNA intención de cobro (se reutiliza al reintentar). */
export function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  // Contextos no seguros (p. ej. http en la red local): sin randomUUID.
  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export type SubmitChargeResult =
  | { kind: "ok"; charge: ChargeDto; replayed: boolean }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

const MESSAGES = {
  network:
    "No pudimos confirmar si el cobro se creó. Revisa tu conexión y vuelve a intentarlo: no se duplicará.",
  unavailable: "El cobro con QR no está disponible por ahora.",
  conflict:
    "Este cobro ya se había enviado con otro importe. Cancela y empieza uno nuevo.",
  invalid: "El importe no es válido. Corrígelo e inténtalo de nuevo.",
  generic: "No pudimos crear el cobro. Inténtalo de nuevo en un momento.",
} as const;

/**
 * Envía el importe CONFIRMADO al servidor. La misma `idempotencyKey` hace que
 * reintentar (doble clic, corte de red, respuesta perdida) devuelva el mismo
 * cobro en vez de crear otro. El servidor revalida todo y deriva el comercio
 * de la sesión.
 */
export async function submitCharge(
  input: { amountCents: number; idempotencyKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitChargeResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { kind: "error", message: MESSAGES.network };
  }

  if (response.status === 401) return { kind: "unauthenticated" };

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      charge?: ChargeDto;
      replayed?: boolean;
    } | null;
    if (body?.charge) {
      return { kind: "ok", charge: body.charge, replayed: !!body.replayed };
    }
    return { kind: "error", message: MESSAGES.generic };
  }

  switch (response.status) {
    case 400:
      return { kind: "error", message: MESSAGES.invalid };
    case 409:
      return { kind: "error", message: MESSAGES.conflict };
    case 503:
      return { kind: "error", message: MESSAGES.unavailable };
    default:
      return { kind: "error", message: MESSAGES.generic };
  }
}

function parseServerTime(value: unknown): number {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export type FetchChargeResult =
  | { kind: "ok"; charge: ChargeDto; serverTime: number }
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  /** Sin red o error del servidor: «verificación no disponible», no un rechazo. */
  | { kind: "unavailable" };

/**
 * Lee el estado PERSISTIDO del cobro (P03). Es la única fuente de verdad: la
 * pantalla nunca decide por sí sola que algo se pagó, venció o se cerró.
 */
export async function fetchCharge(
  chargeId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchChargeResult> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/charges/${chargeId}`, {
      cache: "no-store",
    });
  } catch {
    return { kind: "unavailable" };
  }

  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 404) return { kind: "not_found" };
  if (!response.ok) return { kind: "unavailable" };

  const body = (await response.json().catch(() => null)) as {
    charge?: ChargeDto;
    serverTime?: string;
  } | null;
  if (!body?.charge) return { kind: "unavailable" };
  return {
    kind: "ok",
    charge: body.charge,
    serverTime: parseServerTime(body.serverTime),
  };
}

export type ReconcileChargeClientResult =
  | { kind: "ok"; charge: ChargeDto; serverTime: number }
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  /**
   * Pey no respondió, o no hubo red. Si `charge` viene, es el estado
   * persistido (p. ej. ya venció) y tampoco es un pago confirmado.
   */
  | { kind: "unavailable"; charge?: ChargeDto; serverTime?: number };

/**
 * «Consultar nuevamente»: pide al servidor que pregunte a Pey. El resultado
 * que se muestra es el cobro persistido; un fallo de consulta no marca pagado.
 */
export async function requestReconcile(
  chargeId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReconcileChargeClientResult> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/charges/${chargeId}/reconcile`, {
      method: "POST",
    });
  } catch {
    return { kind: "unavailable" };
  }

  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 404) return { kind: "not_found" };

  const body = (await response.json().catch(() => null)) as {
    charge?: ChargeDto;
    serverTime?: string;
  } | null;
  const serverTime =
    body?.serverTime !== undefined
      ? parseServerTime(body.serverTime)
      : undefined;

  if (response.ok && body?.charge && serverTime !== undefined) {
    return { kind: "ok", charge: body.charge, serverTime };
  }
  if (response.status === 409 && body?.charge && serverTime !== undefined) {
    return { kind: "ok", charge: body.charge, serverTime };
  }
  if (response.status === 503 && body?.charge && serverTime !== undefined) {
    return {
      kind: "unavailable",
      charge: body.charge,
      serverTime,
    };
  }
  return { kind: "unavailable" };
}

export type CloseChargeClientResult =
  | { kind: "ok"; charge: ChargeDto; serverTime: number }
  /** Ya no era cerrable (p. ej. se pagó o venció): `charge` es el estado real. */
  | { kind: "not_closable"; charge: ChargeDto; serverTime: number }
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

const CLOSE_FAILED =
  "No pudimos cerrar el cobro. Revisa tu conexión e inténtalo de nuevo.";

/** «Cerrar cobro»: cierre local; no cancela nada en el banco. */
export async function requestCloseCharge(
  chargeId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CloseChargeClientResult> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/charges/${chargeId}/close`, {
      method: "POST",
    });
  } catch {
    return { kind: "error", message: CLOSE_FAILED };
  }

  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 404) return { kind: "not_found" };

  const body = (await response.json().catch(() => null)) as {
    charge?: ChargeDto;
    serverTime?: string;
  } | null;

  if ((response.ok || response.status === 409) && body?.charge) {
    return {
      kind: response.ok ? "ok" : "not_closable",
      charge: body.charge,
      serverTime: parseServerTime(body.serverTime),
    };
  }
  return { kind: "error", message: CLOSE_FAILED };
}
