import { eq } from "drizzle-orm";
import type { Database } from "@/adapters/db/create-db";
import { merchants } from "@/adapters/db/schema";

/**
 * Datos del comercio que pueden llegar al cliente (A02, encabezado de P01).
 * Es una lista blanca explícita: el identificador de cuenta Pey
 * (`pey_bank_account_id`) y cualquier dato bancario nunca salen de aquí.
 */
export type MerchantProfileDto = {
  name: string;
  receivingAccountLabel: string | null;
  timezone: string;
};

export async function getMerchantProfile(
  db: Database,
  merchantId: string,
): Promise<MerchantProfileDto | null> {
  const [row] = await db
    .select({
      name: merchants.name,
      receivingAccountLabel: merchants.receivingAccountLabel,
      timezone: merchants.timezone,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  return row ?? null;
}
