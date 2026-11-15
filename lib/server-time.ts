import "server-only";

/**
 * Hora del servidor en milisegundos. P03 la usa como base del «tiempo
 * restante», para no depender del reloj (a veces desajustado) del teléfono.
 * Solo llamar tras acceder a datos dinámicos (cookies/sesión).
 */
export function serverNowMs(): number {
  return Date.now();
}
