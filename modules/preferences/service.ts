import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/adapters/db/create-db";
import { merchantPreferences } from "@/adapters/db/schema";

export type PreferencesDto = {
  voiceAnnouncementsEnabled: boolean;
};

/**
 * Cuerpo de `PATCH /api/preferences`. `strictObject` rechaza campos extra:
 * un cliente no puede colar `merchantId` ni nada más; el comercio sale de la
 * sesión.
 */
export const updatePreferencesSchema = z.strictObject({
  voiceAnnouncementsEnabled: z.boolean(),
});

/**
 * Lee las preferencias del comercio. Si aún no existen se crean con sus
 * valores por defecto (audio activado), de forma idempotente.
 */
export async function getPreferences(
  db: Database,
  merchantId: string,
): Promise<PreferencesDto> {
  await db
    .insert(merchantPreferences)
    .values({ merchantId })
    .onConflictDoNothing({ target: merchantPreferences.merchantId });

  const [row] = await db
    .select({
      voiceAnnouncementsEnabled: merchantPreferences.voiceAnnouncementsEnabled,
    })
    .from(merchantPreferences)
    .where(eq(merchantPreferences.merchantId, merchantId))
    .limit(1);

  return row;
}

/** Actualiza únicamente las preferencias del comercio indicado. */
export async function updatePreferences(
  db: Database,
  merchantId: string,
  update: z.infer<typeof updatePreferencesSchema>,
): Promise<PreferencesDto> {
  const [row] = await db
    .insert(merchantPreferences)
    .values({ merchantId, ...update })
    .onConflictDoUpdate({
      target: merchantPreferences.merchantId,
      set: { ...update, updatedAt: new Date() },
    })
    .returning({
      voiceAnnouncementsEnabled: merchantPreferences.voiceAnnouncementsEnabled,
    });

  return row;
}
