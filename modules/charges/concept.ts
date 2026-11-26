/** Tope de Pey para `concept`. Un texto más largo no se envía. */
export const MAX_CONCEPT_LENGTH = 140;

/** Vacío o solo espacios queda en null. El texto escrito se conserva recortado. */
export function normalizeConcept(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
