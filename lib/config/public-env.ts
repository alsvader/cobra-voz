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

/** Falta configuración obligatoria. Nunca incluye valores, solo nombres. */
export class MissingConfigError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Falta configuración obligatoria: ${missing.join(", ")}.`);
    this.name = "MissingConfigError";
    this.missing = missing;
  }
}

export interface SupabasePublicConfig {
  url: string;
  /** Clave PUBLICABLE. La secret / service-role key jamás se usa aquí. */
  publishableKey: string;
}

type EnvSource = Record<string, string | undefined>;

export function getSupabasePublicConfig(
  env: EnvSource = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabasePublicConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !publishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0 || !url || !publishableKey) {
    throw new MissingConfigError(missing);
  }
  return { url, publishableKey };
}
