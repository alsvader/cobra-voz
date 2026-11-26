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

/**
 * Referencia que escribió el comercio. Vacía queda en null. `0001234` es
 * 1234. Más de 7 dígitos o cualquier carácter que no sea dígito no vale.
 */
export function normalizeNumRef(
  value: string | number | null | undefined,
): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > MAX_NUM_REF) {
      return null;
    }
    return value;
  }
  const trimmed = value?.trim() ?? "";
  if (!/^[0-9]{1,7}$/.test(trimmed)) return null;
  return Number(trimmed);
}
