import "server-only";
import { createDb } from "./create-db";

type DbHandle = ReturnType<typeof createDb>;

// Se conserva entre recargas en desarrollo para no abrir un pool por cada HMR.
const globalForDb = globalThis as unknown as { __cobravozDb?: DbHandle };

/**
 * Cliente de BD de runtime (solo servidor). Usa `DATABASE_URL`, que en
 * Supabase debe apuntar al transaction pooler. Se crea de forma perezosa para
 * que importar el módulo no exija la variable (p. ej. durante el build).
 */
export function getDb() {
  if (!globalForDb.__cobravozDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL no está configurada.");
    }
    globalForDb.__cobravozDb = createDb(url);
  }
  return globalForDb.__cobravozDb.db;
}
