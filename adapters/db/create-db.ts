import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function drizzleFor(sql: postgres.Sql) {
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof drizzleFor>;

/**
 * Fábrica sin dependencia de Next.js (reutilizable por seeds y pruebas).
 * El runtime de la app usa `getDb()` desde `./client`.
 *
 * `prepare: false`: el transaction pooler de Supabase no soporta prepared
 * statements (Architecture §12).
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, {
    prepare: false,
    max: options.max ?? 5,
    // Mensajes NOTICE de Postgres fuera de los logs.
    onnotice: () => {},
  });
  return {
    db: drizzleFor(sql),
    close: () => sql.end({ timeout: 5 }),
  };
}
