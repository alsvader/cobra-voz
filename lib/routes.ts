export const ROUTES = {
  home: "/",
  login: "/acceso",
  app: "/inicio",
  settings: "/configuracion",
} as const;

/** Rutas privadas (requieren sesión). P04/P02/P03/A03 se añadirán en sus PR. */
export const PRIVATE_PATH_PREFIXES: readonly string[] = [
  ROUTES.app,
  ROUTES.settings,
];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Destino al que volver tras iniciar sesión. Solo se aceptan rutas privadas
 * propias: cualquier otra cosa (URL absoluta, `//host`, esquemas, `\`) se
 * descarta para evitar open redirects.
 */
export function sanitizeNextPath(
  raw: string | null | undefined,
): string | null {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\")
  ) {
    return null;
  }
  try {
    const url = new URL(raw, "http://cobravoz.invalid");
    if (
      url.origin !== "http://cobravoz.invalid" ||
      !isPrivatePath(url.pathname)
    ) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export type LoginReason = "sesion-expirada" | "sin-comercio";

export function loginUrl(
  options: { next?: string; reason?: LoginReason } = {},
) {
  const params = new URLSearchParams();
  if (options.reason) params.set("motivo", options.reason);
  const next = sanitizeNextPath(options.next);
  if (next) params.set("siguiente", next);
  const query = params.toString();
  return query ? `${ROUTES.login}?${query}` : ROUTES.login;
}
