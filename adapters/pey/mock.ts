import { randomUUID } from "node:crypto";
import type {
  CreateQrOutcome,
  CreateQrRequest,
  PeyAdapter,
  QueriedPayment,
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
  /** Identificadores consultados, en orden. */
  readonly queryCalls: readonly string[];
  /** Programa el pago que devolverá la consulta de ese QR. */
  seedPayment(peyQrId: string, payment: QueriedPayment): void;
};

export function createMockPeyAdapter(
  options: { now?: () => Date; latencyMs?: number } = {},
): MockPeyAdapter {
  const now = options.now ?? (() => new Date());
  const calls: CreateQrRequest[] = [];
  const queryCalls: string[] = [];
  const issued = new Map<string, CreateQrRequest>();
  const seeded = new Map<string, QueriedPayment[]>();

  return {
    kind: "mock",
    calls,
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
  };
}
