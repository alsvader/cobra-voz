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
