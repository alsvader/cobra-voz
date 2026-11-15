/**
 * Protección para herramientas que escriben datos de prueba: solo pueden
 * apuntar a infraestructura local, jamás a Preview o Producción.
 */
const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "host.docker.internal",
]);

export function isLocalUrl(rawUrl: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

export function assertLocalDatabase(databaseUrl: string) {
  if (!isLocalUrl(databaseUrl)) {
    throw new Error(
      "Operación rechazada: DATABASE_URL no apunta a una base local.",
    );
  }
}
