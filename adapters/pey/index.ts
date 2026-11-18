import { createMockPeyAdapter } from "./mock";
import { createRealPeyAdapter } from "./real";
import type { PeyAdapter } from "./types";

export { REAL_QR_AMOUNT_CENTS } from "./contract";

export type {
  CreatePushOutcome,
  CreatePushRequest,
  CreateQrOutcome,
  CreateQrRequest,
  PeyAdapter,
  QueriedPayment,
  QueryPushPaymentOutcome,
  QueryQrPaymentsOutcome,
} from "./types";
export { isSimulatedQr } from "./mock";

/** No hay un proveedor de QR utilizable en este entorno. */
export class PeyNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeyNotConfiguredError";
  }
}

type Env = Record<string, string | undefined>;

/**
 * El simulador exige permiso EXPLÍCITO: `NEXT_PUBLIC_APP_ENV` debe ser
 * `local` o `preview`, y el despliegue no puede ser de producción en Vercel.
 * Un valor ausente o desconocido NO habilita el simulador (falla cerrado): un
 * Production mal configurado nunca debe emitir QR de prueba.
 */
export function isMockPeyAllowed(env: Env): boolean {
  if (env.VERCEL_ENV === "production") return false;
  return (
    env.NEXT_PUBLIC_APP_ENV === "local" || env.NEXT_PUBLIC_APP_ENV === "preview"
  );
}

let cachedMock: PeyAdapter | undefined;

/**
 * Elige el adaptador.
 * - Local/Preview → simulador, aunque exista `PEY_API_KEY`.
 * - Producción con `PEY_API_KEY` → cliente real. El QR que crea es de $0.01.
 * - Cualquier otro caso → bloqueado, en lugar de devolver QR falsos.
 */
export function getPeyAdapter(
  env: Env = {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    PEY_API_KEY: process.env.PEY_API_KEY,
  },
): PeyAdapter {
  if (isMockPeyAllowed(env)) {
    cachedMock ??= createMockPeyAdapter();
    return cachedMock;
  }

  const apiKey = env.PEY_API_KEY?.trim();
  if (apiKey) return createRealPeyAdapter({ apiKey });

  throw new PeyNotConfiguredError(
    "La integración con Pey no está configurada en este entorno.",
  );
}
