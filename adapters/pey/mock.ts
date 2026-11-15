import { randomUUID } from "node:crypto";
import type { CreateQrOutcome, CreateQrRequest, PeyAdapter } from "./types";

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

export function isSimulatedQr(qrPayload: string): boolean {
  return qrPayload.startsWith(MOCK_QR_PREFIX);
}

export type MockPeyAdapter = PeyAdapter & {
  /** Veces que se pidió crear un QR (las pruebas verifican que no se repite). */
  readonly calls: readonly CreateQrRequest[];
};

export function createMockPeyAdapter(
  options: { now?: () => Date; latencyMs?: number } = {},
): MockPeyAdapter {
  const now = options.now ?? (() => new Date());
  const calls: CreateQrRequest[] = [];

  return {
    kind: "mock",
    calls,
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

      return {
        status: "created",
        peyQrId: `mock-qr-${randomUUID()}`,
        qrString: `${MOCK_QR_PREFIX}${request.chargeId}|${request.amountCents}|${request.numRef}`,
        expiresAt: new Date(now().getTime() + request.expirationSeconds * 1000),
      };
    },
  };
}
