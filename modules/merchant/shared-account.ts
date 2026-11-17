import { isMockPeyAllowed } from "@/adapters/pey";

/**
 * Cuenta Pey del comercio de prueba local. El seed ya la usa. El registro
 * la copia cuando el entorno de simulador no trae `PEY_BANK_ACCOUNT_ID`.
 */
export const LOCAL_DEMO_BANK_ACCOUNT_ID = "local-demo-account";

/**
 * Identificador de la cuenta receptora que comparten los comercios nuevos.
 * Solo se lee en el servidor. En producción, sin la variable, el registro
 * no crea el comercio. En local o preview el simulador puede usar la cuenta
 * de prueba.
 */
export function sharedBankAccountId(
  env: Record<string, string | undefined>,
): string | null {
  const configured = env.PEY_BANK_ACCOUNT_ID?.trim();
  if (configured) return configured;
  if (isMockPeyAllowed(env)) return LOCAL_DEMO_BANK_ACCOUNT_ID;
  return null;
}
