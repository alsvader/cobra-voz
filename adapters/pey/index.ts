import { createMockPeyAdapter } from "./mock";
import type { PeyAdapter } from "./types";

export type { CreateQrOutcome, CreateQrRequest, PeyAdapter } from "./types";
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
 * - Local/Preview → simulador.
 * - Cualquier otro caso → bloqueado hasta integrar Pey real (H5), en lugar de
 *   devolver QR falsos.
 */
export function getPeyAdapter(
  env: Env = {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
): PeyAdapter {
  if (isMockPeyAllowed(env)) {
    cachedMock ??= createMockPeyAdapter();
    return cachedMock;
  }

  throw new PeyNotConfiguredError(
    "La integración con Pey no está configurada en este entorno.",
  );
}
