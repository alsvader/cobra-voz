import { randomInt } from "node:crypto";

/** `numRef` de Pey: numérico, máximo 7 dígitos (0..9 999 999). */
export const MAX_NUM_REF = 9_999_999;

/** Vigencia inicial del QR en segundos (RN-08; compatibilidad exacta a validar con Pey). */
export const QR_EXPIRATION_SECONDS = 600;

/**
 * Referencia humana del cobro (`CV-XXXXXXXX`), derivada del UUID interno. Es
 * distinta de `numRef` (la referencia numérica que viaja a Pey).
 */
export function chargeReference(chargeId: string): string {
  return `CV-${chargeId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function randomNumRef(): number {
  return randomInt(0, MAX_NUM_REF + 1);
}
