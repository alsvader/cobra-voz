import { pesosNumberToCents } from "@/modules/charges/amount";
import {
  REAL_QR_AMOUNT_CENTS,
  canonicalCodiId,
  centsToPeyAmountToken,
} from "./contract";
import type {
  CreatePushOutcome,
  CreatePushRequest,
  CreateQrOutcome,
  CreateQrRequest,
  PeyAdapter,
  QueriedPayment,
  QueryPushPaymentOutcome,
  QueryQrPaymentsOutcome,
} from "./types";

const BASE_URL = "https://api.pey.mx";
const TIMEOUT_MS = 10_000;
/** Tope de páginas de `nextToken`. Si no termina, la consulta queda unavailable. */
const MAX_PAGES = 5;
const MIN_EXPIRATION_SECONDS = 360;
const MIN_UNIX_SECONDS = 1_500_000_000;
const MAX_UNIX_SECONDS = 4_000_000_000;

export type RealPeyOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};

type Page = {
  items: unknown[];
  nextToken: string | null;
};

/**
 * Cliente de la API vigente de Pey (OpenAPI 2026-10-20, `https://api.pey.mx`).
 *
 * `POST /codi/qr` siempre manda `amount` 0.01, aunque el cobro guarde otro
 * importe. `numRef` viaja como texto de dígitos. `generateImage` va en false:
 * el QR se dibuja desde `qrString`. Una sola llamada; un fallo es incierto.
 *
 * `GET /transaction/codi/qr/:id` lista los pagos de un id que Pey ya devolvió
 * y sigue `nextToken`. Esa lista no trae referencia ni cuenta: quedan en null
 * y la conciliación usa las del QR guardado. `GET /transaction/:id` solo
 * confirma un pago de esa lista al que le falta importe o fecha.
 */
export function createRealPeyAdapter(options: RealPeyOptions): PeyAdapter {
  const apiKey = options.apiKey.trim();
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  async function request(
    url: string,
    init: RequestInit,
  ): Promise<Response | undefined> {
    try {
      return await fetchImpl(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return undefined;
    }
  }

  return {
    kind: "real",
    async createCodiQr(input): Promise<CreateQrOutcome> {
      const body = buildCreateBody(input);
      if (!body) {
        return {
          status: "uncertain",
          reason: "La solicitud del QR no cumple el contrato de Pey.",
        };
      }

      const response = await request(`${BASE_URL}/codi/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response) {
        return {
          status: "uncertain",
          reason: "Pey no respondió al crear el QR.",
        };
      }
      if (response.status !== 201) {
        const errorType = peyErrorType(await readJson(response));
        return {
          status: "uncertain",
          reason: `Pey no confirmó la creación del QR (HTTP ${response.status}${errorType ? `, ${errorType}` : ""}).`,
        };
      }

      const created = parseCreated(await readJson(response), input, now());
      if (!created) {
        return {
          status: "uncertain",
          reason: "La respuesta de Pey no trae un QR utilizable.",
        };
      }
      return created;
    },

    async createCodiPush(input): Promise<CreatePushOutcome> {
      const body = buildPushBody(input);
      if (!body) {
        return {
          status: "uncertain",
          reason:
            "La solicitud de la notificación no cumple el contrato de Pey.",
        };
      }

      const response = await request(`${BASE_URL}/codi/pn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response) {
        return {
          status: "uncertain",
          reason: "Pey no respondió al enviar la notificación.",
        };
      }
      if (response.status !== 200) {
        const errorType = peyErrorType(await readJson(response));
        return {
          status: "uncertain",
          reason: `Pey no confirmó el envío de la notificación (HTTP ${response.status}${errorType ? `, ${errorType}` : ""}).`,
        };
      }

      // El folio de 20 dígitos a veces llega como número. JSON.parse lo
      // redondea; hay que leerlo del texto crudo.
      const raw = await response.text();
      return parsePushCreated(parseJson(raw), raw, input, now());
    },

    async queryCodiQrPayments(peyQrId): Promise<QueryQrPaymentsOutcome> {
      const id = peyQrId.trim();
      if (!id || id.length > 128) {
        return {
          status: "unavailable",
          reason: "No hay un QR de Pey que consultar.",
        };
      }

      const payments: QueriedPayment[] = [];
      let token: string | null = null;
      const seen = new Set<string>();

      for (let page = 0; page < MAX_PAGES; page += 1) {
        const url = new URL(
          `${BASE_URL}/transaction/codi/qr/${encodeURIComponent(id)}`,
        );
        if (token) url.searchParams.set("nextToken", token);

        const response = await request(url.toString(), { method: "GET" });
        if (!response || !response.ok) {
          return {
            status: "unavailable",
            reason: "Pey no confirmó la consulta del QR.",
          };
        }

        const parsed = parsePage(await readJson(response));
        if (!parsed) {
          return {
            status: "unavailable",
            reason: "La consulta de Pey no tiene la forma esperada.",
          };
        }

        for (const item of parsed.items) {
          const resolved = await resolveItem(item, id, request);
          if (resolved === "unavailable") {
            return {
              status: "unavailable",
              reason: "Pey no confirmó un pago de la lista.",
            };
          }
          if (resolved) payments.push(resolved);
        }

        if (!parsed.nextToken) return { status: "ok", payments };
        if (seen.has(parsed.nextToken)) {
          return {
            status: "unavailable",
            reason: "La consulta de Pey repitió la página.",
          };
        }
        seen.add(parsed.nextToken);
        token = parsed.nextToken;
      }

      return {
        status: "unavailable",
        reason: "La consulta de Pey no terminó la lista.",
      };
    },

    async queryCodiPushPayment(
      transactionId,
    ): Promise<QueryPushPaymentOutcome> {
      const id = transactionId.trim();
      if (!id || id.length > 128) {
        return {
          status: "unavailable",
          reason: "No hay una notificación de Pey que consultar.",
        };
      }

      const response = await request(
        `${BASE_URL}/transaction/${encodeURIComponent(id)}`,
        { method: "GET" },
      );
      if (!response || !response.ok) {
        return {
          status: "unavailable",
          reason: "Pey no confirmó la consulta de la notificación.",
        };
      }

      const parsed = parsePushTransaction(await readJson(response), id);
      if (!parsed) {
        return {
          status: "unavailable",
          reason: "La consulta de la notificación no tiene la forma esperada.",
        };
      }
      if (parsed === "pending") {
        return { status: "ok", payment: null, chargeId: null };
      }
      return {
        status: "ok",
        payment: parsed.payment,
        chargeId: parsed.chargeId,
      };
    },
  };
}

function buildCreateBody(request: CreateQrRequest): string | null {
  if (
    !Number.isInteger(request.numRef) ||
    request.numRef < 0 ||
    request.numRef > 9_999_999
  ) {
    return null;
  }
  if (
    !Number.isInteger(request.expirationSeconds) ||
    request.expirationSeconds < MIN_EXPIRATION_SECONDS
  ) {
    return null;
  }
  if (!request.bankAccountId.trim() || request.bankAccountId.length > 128) {
    return null;
  }
  if (!request.chargeId.trim() || request.chargeId.length > 128) return null;

  const fields = JSON.stringify({
    concept: request.concept,
    expiration: request.expirationSeconds,
    numRef: String(request.numRef),
    generateImage: false,
    bankAccountId: request.bankAccountId,
    metadata: { chargeId: request.chargeId },
  });
  const amount = centsToPeyAmountToken(REAL_QR_AMOUNT_CENTS);
  return `{"amount":${amount},${fields.slice(1)}`;
}

function buildPushBody(request: CreatePushRequest): string | null {
  if (!/^[0-9]{10}$/.test(request.phoneNumber)) return null;
  const shared = buildCreateBody({
    chargeId: request.chargeId,
    amountCents: request.amountCents,
    concept: request.concept,
    numRef: request.numRef,
    expirationSeconds: request.expirationSeconds,
    bankAccountId: request.bankAccountId,
  });
  if (!shared) return null;
  const fields = JSON.parse(shared) as Record<string, unknown>;
  delete fields.amount;
  delete fields.generateImage;
  fields.phoneNumber = request.phoneNumber;
  const amount = centsToPeyAmountToken(REAL_QR_AMOUNT_CENTS);
  const rest = JSON.stringify(fields);
  return `{"amount":${amount},${rest.slice(1)}`;
}

function parsePushCreated(
  json: unknown,
  raw: string,
  request: CreatePushRequest,
  now: Date,
): CreatePushOutcome {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return {
      status: "uncertain",
      reason: "La respuesta de Pey no trae una notificación utilizable.",
    };
  }
  const row = json as Record<string, unknown>;
  const errorType = peyErrorType(json);
  if (errorType) {
    return {
      status: "uncertain",
      reason: `Pey no confirmó el envío de la notificación (HTTP 200, ${errorType}).`,
    };
  }

  const transactionId = readTransactionId(row);
  const codiId = readCodiId(row, raw);
  if (!transactionId || !codiId) {
    return {
      status: "uncertain",
      reason: `La respuesta de Pey no trae una notificación utilizable (${pushShape(row)}).`,
    };
  }
  return {
    status: "created",
    transactionId,
    codiId,
    expiresAt: new Date(now.getTime() + request.expirationSeconds * 1000),
  };
}

function readTransactionId(row: Record<string, unknown>): string | null {
  const value = row.transactionId ?? row.id;
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > 128) return null;
  return id;
}

/** Folio de Pey: 20 dígitos, un número en el JSON crudo, o un token con letras. */
function readCodiId(row: Record<string, unknown>, raw: string): string | null {
  const value = row.codiId ?? row.codi_id;
  if (typeof value === "string") return canonicalCodiId(value);
  const match = raw.match(
    /"(?:codiId|codi_id)"\s*:\s*(?:"([0-9]{20})"|([0-9]{20})(?![0-9]))/,
  );
  return match?.[1] ?? match?.[2] ?? null;
}

/** Claves y tipos, nunca el folio, el celular ni el mensaje libre de Pey. */
function pushShape(row: Record<string, unknown>): string {
  const keys = Object.keys(row).slice(0, 12).join(",") || "ninguna";
  return `claves: ${keys}; transactionId: ${valueKind(row.transactionId ?? row.id)}; codiId: ${folioKind(row.codiId ?? row.codi_id)}`;
}

function folioKind(value: unknown): string {
  if (typeof value !== "string") return valueKind(value);
  const token = value.normalize("NFKC").trim();
  let digits = 0;
  let letters = 0;
  let other = 0;
  for (const char of token) {
    if (char >= "0" && char <= "9") digits += 1;
    else if ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z")) {
      letters += 1;
    } else other += 1;
  }
  return `texto(${token.length},D${digits}L${letters}O${other})`;
}

function valueKind(value: unknown): string {
  if (value == null) return "ausente";
  if (typeof value === "string") return `texto(${value.trim().length})`;
  if (typeof value === "number") return "numero";
  return typeof value;
}

function parseJson(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function parsePushTransaction(
  json: unknown,
  transactionId: string,
): "pending" | { payment: QueriedPayment; chargeId: string | null } | null {
  if (!json || typeof json !== "object") return null;
  const row = json as Record<string, unknown>;
  if (row.payableType != null && row.payableType !== "API_CODI_PN") return null;
  if (row.paymentMethod != null && row.paymentMethod !== "CODI") return null;
  if (row.currency != null && row.currency !== "MXN") return null;
  if (row.status === "PENDING") return "pending";
  if (row.status !== "PAID") return null;
  if (row.payableType !== "API_CODI_PN") return null;

  const listed = readPayment({ ...row, id: transactionId });
  if (listed === "bad" || !listed) return null;
  return { payment: listed, chargeId: readExternalChargeId(row.metadata) };
}

function readExternalChargeId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const external = (metadata as { externalMetadata?: unknown })
    .externalMetadata;
  if (!external || typeof external !== "object") return null;
  const chargeId = (external as { chargeId?: unknown }).chargeId;
  if (typeof chargeId !== "string") return null;
  const trimmed = chargeId.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

function parseCreated(
  json: unknown,
  request: CreateQrRequest,
  now: Date,
): CreateQrOutcome | null {
  if (!json || typeof json !== "object") return null;
  const row = json as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.trim() || row.id.length > 128) {
    return null;
  }
  if (typeof row.qrString !== "string" || !row.qrString.trim()) return null;
  return {
    status: "created",
    peyQrId: row.id.trim(),
    qrString: row.qrString,
    expiresAt: new Date(now.getTime() + request.expirationSeconds * 1000),
  };
}

function parsePage(json: unknown): Page | null {
  if (!json || typeof json !== "object") return null;
  const row = json as Record<string, unknown>;
  if (!Array.isArray(row.items)) return null;
  if (row.nextToken == null) return { items: row.items, nextToken: null };
  if (typeof row.nextToken !== "string" || !row.nextToken.trim()) return null;
  return { items: row.items, nextToken: row.nextToken };
}

type FetchRequest = (
  url: string,
  init: RequestInit,
) => Promise<Response | undefined>;

async function resolveItem(
  item: unknown,
  qrId: string,
  request: FetchRequest,
): Promise<QueriedPayment | null | "unavailable"> {
  if (!item || typeof item !== "object") return "unavailable";
  const row = item as Record<string, unknown>;
  if (row.status === "PENDING") return null;
  if (row.status !== "PAID") return "unavailable";
  if (row.currency != null && row.currency !== "MXN") return "unavailable";
  if (typeof row.id !== "string" || !row.id.trim() || row.id.length > 128) {
    return "unavailable";
  }

  const listed = readPayment(row);
  if (listed === "bad") return "unavailable";
  if (listed) return listed;

  const response = await request(
    `${BASE_URL}/transaction/${encodeURIComponent(row.id.trim())}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return "unavailable";
  const body = await readJson(response);
  if (!body || typeof body !== "object") return "unavailable";
  const confirmed = body as Record<string, unknown>;
  if (confirmed.payableId != null && confirmed.payableId !== qrId) {
    return "unavailable";
  }
  if (
    confirmed.payableType != null &&
    confirmed.payableType !== "API_CODI_QR"
  ) {
    return "unavailable";
  }
  if (confirmed.status !== "PAID") return null;
  const payment = readPayment({ ...confirmed, id: row.id });
  if (payment === "bad" || !payment) return "unavailable";
  return payment;
}

/** `null` si al pago le falta importe o fecha y hay que confirmarlo. */
function readPayment(
  row: Record<string, unknown>,
): QueriedPayment | null | "bad" {
  if (typeof row.id !== "string" || !row.id.trim()) return "bad";
  const amount = readAmount(row.amount);
  const paidAt = readUnixSeconds(row.datePaid);
  const numRef = readNumRef(row.numRef);
  const bankAccountId = readAccount(row.bankAccountId);
  if (
    amount === "bad" ||
    paidAt === "bad" ||
    numRef === "bad" ||
    bankAccountId === "bad"
  ) {
    return "bad";
  }
  if (amount == null || paidAt == null) return null;
  return {
    transactionId: row.id.trim(),
    amountCents: amount,
    numRef,
    bankAccountId,
    paidAt,
  };
}

function readAmount(value: unknown): number | null | "bad" {
  if (value == null) return null;
  if (typeof value !== "number") return "bad";
  const parsed = pesosNumberToCents(value);
  return parsed.ok ? parsed.cents : "bad";
}

function readUnixSeconds(value: unknown): Date | null | "bad" {
  if (value == null) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_UNIX_SECONDS ||
    value > MAX_UNIX_SECONDS
  ) {
    return "bad";
  }
  return new Date(value * 1000);
}

function readNumRef(value: unknown): number | null | "bad" {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > 9_999_999)
      return "bad";
    return value;
  }
  if (typeof value === "string" && /^[0-9]{1,7}$/.test(value))
    return Number(value);
  return "bad";
}

function readAccount(value: unknown): string | null | "bad" {
  if (value == null) return null;
  if (typeof value !== "string") return "bad";
  const account = value.trim();
  if (!account || account.length > 128) return "bad";
  return account;
}

/** Solo el código de error de Pey, nunca el mensaje libre ni la API key. */
function peyErrorType(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const error = (json as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const type = (error as { type?: unknown }).type;
  if (typeof type !== "string" || !/^[A-Z_]{1,64}$/.test(type)) return null;
  return type;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
