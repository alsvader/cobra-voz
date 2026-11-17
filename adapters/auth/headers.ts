/**
 * Cabeceras de la API admin de Auth.
 * `sb_secret_` y `sb_publishable_` no son JWT: GoTrue rechaza
 * `Authorization: Bearer` con ellas (`bad_jwt`). Van solo en `apikey`.
 * Una clave legacy (`eyJ…`) sí se manda como Bearer.
 */
export function authAdminHeaders(secretKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: secretKey,
    "Content-Type": "application/json",
  };
  if (!isOpaqueSupabaseKey(secretKey)) {
    headers.Authorization = `Bearer ${secretKey}`;
  }
  return headers;
}

function isOpaqueSupabaseKey(key: string): boolean {
  return key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
}
