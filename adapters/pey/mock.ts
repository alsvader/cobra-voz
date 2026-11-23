import { randomInt, randomUUID } from "node:crypto";
import type {
  CreateCounterQrRequest,
  CreatePaymentLinkOutcome,
  CreatePaymentLinkRequest,
  CreatePushOutcome,
  CreatePushRequest,
  CreateQrOutcome,
  CreateQrRequest,
  PeyAdapter,
  QueriedPayment,
  QueryPaymentLinkOutcome,
  QueryPushPaymentOutcome,
  QueryQrPaymentsOutcome,
} from "./types";

/**
 * Simulador de Pey: SOLO para Local/Preview (ver `getPeyAdapter`).
 *
 * El `qrString` que produce está rotulado con `MOCK_QR_PREFIX` y NO es un
 * payload CoDi válido: ninguna app bancaria puede pagarlo. La interfaz debe
 * mostrarlo siempre como «QR de prueba» (`isSimulatedQr`). Nunca se presenta
 * como QR real.
 */
export const MOCK_QR_PREFIX = "COBRAVOZ-MOCK|";

/**
 * Importe «mágico» ($13.01) que fuerza un resultado INCIERTO (timeout) para
 * poder probar el camino sin reintento ciego. Solo existe en el simulador.
 */
export const MOCK_UNCERTAIN_AMOUNT_CENTS = 1301;

/**
 * Importe «mágico» ($13.02) cuya CONSULTA de conciliación encuentra un pago
 * que coincide. La creación del QR sigue siendo normal: sirve para probar
 * un aviso que nunca llegó por webhook. Solo existe en el simulador.
 */
export const MOCK_QUERY_PAID_AMOUNT_CENTS = 1302;

/**
 * Importe «mágico» ($13.03) cuya consulta de conciliación no obtiene
 * respuesta. No acredita el cobro. Solo existe en el simulador.
 */
export const MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS = 1303;

export function isSimulatedQr(qrPayload: string): boolean {
  return qrPayload.startsWith(MOCK_QR_PREFIX);
}

export type MockPeyAdapter = PeyAdapter & {
  /** Veces que se pidió crear un QR (las pruebas verifican que no se repite). */
  readonly calls: readonly CreateQrRequest[];
  /** Veces que se pidió el QR fijo del mostrador. */
  readonly counterCalls: readonly CreateCounterQrRequest[];
  /** Veces que se pidió enviar una notificación. */
  readonly pushCalls: readonly CreatePushRequest[];
  /** Veces que se pidió crear un enlace. */
  readonly linkCalls: readonly CreatePaymentLinkRequest[];
  /** Identificadores consultados, en orden. */
  readonly queryCalls: readonly string[];
  /** Programa el pago que devolverá la consulta de ese QR o transacción. */
  seedPayment(providerId: string, payment: QueriedPayment): void;
};

export function createMockPeyAdapter(
  options: { now?: () => Date; latencyMs?: number } = {},
): MockPeyAdapter {
  const now = options.now ?? (() => new Date());
  const calls: CreateQrRequest[] = [];
  const counterCalls: CreateCounterQrRequest[] = [];
  const pushCalls: CreatePushRequest[] = [];
  const linkCalls: CreatePaymentLinkRequest[] = [];
  const queryCalls: string[] = [];
  const issued = new Map<string, CreateQrRequest>();
  const issuedPush = new Map<string, CreatePushRequest>();
  const issuedLinks = new Map<string, CreatePaymentLinkRequest>();
  const seeded = new Map<string, QueriedPayment[]>();

  return {
    kind: "mock",
    calls,
    counterCalls,
    pushCalls,
    linkCalls,
    queryCalls,
    seedPayment(peyQrId, payment) {
      const list = seeded.get(peyQrId) ?? [];
      list.push(payment);
      seeded.set(peyQrId, list);
    },
    async createCodiQr(request): Promise<CreateQrOutcome> {
      calls.push(request);
      if (options.latencyMs) {
        await new Promise((resolve) => setTimeout(resolve, options.latencyMs));
      }

      if (request.amountCents === MOCK_UNCERTAIN_AMOUNT_CENTS) {
        return {
          status: "uncertain",
          reason: "Simulación: la solicitud a Pey agotó el tiempo de espera.",
        };
      }

      const peyQrId = `mock-qr-${randomUUID()}`;
      issued.set(peyQrId, request);
      return {
        status: "created",
        peyQrId,
        qrString: `${MOCK_QR_PREFIX}${request.chargeId}|${request.amountCents}|${request.numRef}`,
        expiresAt: new Date(now().getTime() + request.expirationSeconds * 1000),
      };
    },
    async queryCodiQrPayments(peyQrId): Promise<QueryQrPaymentsOutcome> {
      queryCalls.push(peyQrId);
      const known = issued.get(peyQrId);
      const programmed = seeded.get(peyQrId);
      if (!known && !programmed) {
        return {
          status: "unavailable",
          reason: "Simulación: este proceso no emitió ese QR.",
        };
      }
      if (known?.amountCents === MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS) {
        return {
          status: "unavailable",
          reason: "Simulación: Pey no respondió a la consulta.",
        };
      }
      if (programmed) return { status: "ok", payments: programmed };
      if (known?.amountCents === MOCK_QUERY_PAID_AMOUNT_CENTS) {
        return {
          status: "ok",
          payments: [
            {
              transactionId: `mock-tx-${peyQrId}`,
              amountCents: known.amountCents,
              numRef: known.numRef,
              bankAccountId: known.bankAccountId,
              paidAt: now(),
            },
          ],
        };
      }
      return { status: "ok", payments: [] };
    },
    async createCounterQr(request) {
      counterCalls.push(request);
      return {
        status: "created" as const,
        peyQrId: `mock-counter-${randomUUID()}`,
        qrString: `${MOCK_QR_PREFIX}counter|${request.merchantId}|${request.numRef}`,
      };
    },
    async createCodiPush(request): Promise<CreatePushOutcome> {
      pushCalls.push(request);
      if (request.amountCents === MOCK_UNCERTAIN_AMOUNT_CENTS) {
        return {
          status: "uncertain",
          reason: "Simulación: la solicitud a Pey agotó el tiempo de espera.",
        };
      }
      const transactionId = `mock-pn-${randomUUID()}`;
      issuedPush.set(transactionId, request);
      return {
        status: "created",
        transactionId,
        codiId: Array.from({ length: 20 }, () => randomInt(0, 10)).join(""),
        expiresAt: new Date(now().getTime() + request.expirationSeconds * 1000),
      };
    },
    async queryCodiPushPayment(
      transactionId,
    ): Promise<QueryPushPaymentOutcome> {
      queryCalls.push(transactionId);
      const known = issuedPush.get(transactionId);
      const programmed = seeded.get(transactionId);
      if (!known && !programmed) {
        return {
          status: "unavailable",
          reason: "Simulación: este proceso no envió esa notificación.",
        };
      }
      if (known?.amountCents === MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS) {
        return {
          status: "unavailable",
          reason: "Simulación: Pey no respondió a la consulta.",
        };
      }
      const payment = programmed?.[0];
      if (payment) {
        return { status: "ok", payment, chargeId: known?.chargeId ?? null };
      }
      if (known?.amountCents === MOCK_QUERY_PAID_AMOUNT_CENTS) {
        return {
          status: "ok",
          payment: {
            transactionId,
            amountCents: known.amountCents,
            numRef: known.numRef,
            bankAccountId: known.bankAccountId,
            paidAt: now(),
          },
          chargeId: known.chargeId,
        };
      }
      return { status: "ok", payment: null, chargeId: known?.chargeId ?? null };
    },
    async createPaymentLink(request): Promise<CreatePaymentLinkOutcome> {
      linkCalls.push(request);
      if (request.amountCents === MOCK_UNCERTAIN_AMOUNT_CENTS) {
        return {
          status: "uncertain",
          reason: "Simulación: la solicitud a Pey agotó el tiempo de espera.",
        };
      }
      const peyPaymentLinkId = `mock-link-${randomUUID()}`;
      issuedLinks.set(peyPaymentLinkId, request);
      return {
        status: "created",
        peyPaymentLinkId,
        url: `https://app.mipey.mx/payment-link/${peyPaymentLinkId}`,
        expiresAt: new Date(now().getTime() + request.expirationSeconds * 1000),
      };
    },
    async queryPaymentLink(peyPaymentLinkId): Promise<QueryPaymentLinkOutcome> {
      queryCalls.push(peyPaymentLinkId);
      const known = issuedLinks.get(peyPaymentLinkId);
      if (!known) {
        return {
          status: "unavailable",
          reason: "Simulación: este proceso no creó ese enlace.",
        };
      }
      if (known.amountCents === MOCK_QUERY_UNAVAILABLE_AMOUNT_CENTS) {
        return {
          status: "unavailable",
          reason: "Simulación: Pey no respondió a la consulta.",
        };
      }
      if (known.amountCents === MOCK_QUERY_PAID_AMOUNT_CENTS) {
        return {
          status: "ok",
          state: "paid",
          transaction: {
            transactionId: `mock-tx-${peyPaymentLinkId}`,
            amountCents: known.amountCents,
            baseCents: known.amountCents,
            paidAt: now(),
          },
        };
      }
      return { status: "ok", state: "pending", transaction: null };
    },
  };
}
