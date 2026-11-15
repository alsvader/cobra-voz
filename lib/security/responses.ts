/** Cabeceras de respuestas con datos privados: nunca cacheables (Architecture §11). */
export const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0";

export function privateJson(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  headers.set("Vary", "Cookie");
  return Response.json(body, { ...init, headers });
}

export function errorJson(
  status: number,
  code: string,
  message: string,
): Response {
  return privateJson({ error: { code, message } }, { status });
}
