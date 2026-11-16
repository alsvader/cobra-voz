import { timingSafeEqual } from "node:crypto";

/**
 * Compara `Authorization: Bearer <secreto>` sin filtrar el secreto por tiempo
 * ni por el mensaje de error. Un secreto vacío nunca coincide.
 */
export function bearerMatches(header: string | null, secret: string): boolean {
  if (!secret) return false;
  const provided = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
