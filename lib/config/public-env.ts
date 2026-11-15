/**
 * Configuración pública (segura para el navegador).
 *
 * Solo variables `NEXT_PUBLIC_*`. Las claves privadas (Pey, OpenAI, DB, cron)
 * jamás se leen aquí ni llevan prefijo `NEXT_PUBLIC_` (RN-20).
 */
export type AppEnvironment = "local" | "preview" | "production";

export interface PublicConfig {
  appUrl: string;
  appEnv: AppEnvironment;
}

const APP_ENVIRONMENTS: readonly AppEnvironment[] = [
  "local",
  "preview",
  "production",
];

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  return APP_ENVIRONMENTS.find((env) => env === value) ?? "local";
}

export function getPublicConfig(): PublicConfig {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    appEnv: parseAppEnvironment(process.env.NEXT_PUBLIC_APP_ENV),
  };
}

/**
 * Los simuladores (adaptador Pey mock) solo pueden usarse fuera de producción.
 * Producción debe conectarse a Pey real o quedar claramente bloqueada.
 */
export function isSimulationAllowed(env: AppEnvironment): boolean {
  return env !== "production";
}
