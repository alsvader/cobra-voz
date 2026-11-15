import { eq } from "drizzle-orm";
import type { Database } from "@/adapters/db/create-db";
import { merchantUsers } from "@/adapters/db/schema";

/**
 * Comercio al que pertenece un usuario de Auth, o `null` si no tiene ninguno.
 *
 * Tener sesión NO da acceso global (Architecture §3): el `merchant_id` que usa
 * el resto del sistema sale siempre de aquí, jamás de la petición del cliente.
 */
export async function findMerchantIdForUser(
  db: Database,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ merchantId: merchantUsers.merchantId })
    .from(merchantUsers)
    .where(eq(merchantUsers.userId, userId))
    .limit(1);

  return row?.merchantId ?? null;
}
