/**
 * Celular mexicano de 10 dígitos. Acepta espacios y guiones; rechaza la lada.
 * El resultado es solo dígitos, listo para `POST /codi/pn`.
 */
export function normalizeMxPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!/^[0-9]{10}$/.test(digits)) return null;
  return digits;
}

export function phoneLast4(phone: string): string {
  return phone.slice(-4);
}
