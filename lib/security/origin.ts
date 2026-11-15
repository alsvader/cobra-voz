/**
 * Protección CSRF para Route Handlers con cookie (Architecture §11).
 *
 * Los Server Actions ya comparan Origin y Host; los Route Handlers no, así que
 * toda mutación debe pasar por aquí. Se exige un `Origin` presente y cuyo host
 * coincida con el host de la petición: un formulario de otro sitio no puede
 * falsificarlo y un cliente sin `Origin` se rechaza.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isMutation(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

function requestHost(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded ?? request.headers.get("host");
  // Con proxies puede venir una lista: manda el primer valor.
  return host ? host.split(",")[0].trim().toLowerCase() : null;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = requestHost(request);
  if (!origin || origin === "null" || !host) {
    return false;
  }
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}
