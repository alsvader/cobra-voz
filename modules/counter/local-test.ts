type Env = Record<string, string | undefined>;

/**
 * El botón de pago de prueba solo existe en local. Preview y producción
 * quedan fuera, y un entorno ausente o desconocido también: no se hereda
 * el valor por defecto de la configuración pública.
 */
export function isLocalCounterTestAllowed(
  env: Env = {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
): boolean {
  if (env.VERCEL_ENV === "production") return false;
  return env.NEXT_PUBLIC_APP_ENV === "local";
}
