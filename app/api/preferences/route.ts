import { getDb } from "@/adapters/db/client";
import { withMerchantApi } from "@/modules/identity/api";
import {
  getPreferences,
  updatePreferences,
  updatePreferencesSchema,
} from "@/modules/preferences/service";
import { errorJson, privateJson } from "@/lib/security/responses";

/** GET /api/preferences — preferencias del comercio de la sesión. */
export const GET = withMerchantApi(async (_request, { merchantId }) => {
  return privateJson(await getPreferences(getDb(), merchantId));
});

/** PATCH /api/preferences — actualiza las preferencias del comercio de la sesión. */
export const PATCH = withMerchantApi(async (request, { merchantId }) => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = updatePreferencesSchema.safeParse(body);

  if (!parsed.success) {
    return errorJson(400, "invalid_request", "Solicitud no válida.");
  }

  return privateJson(await updatePreferences(getDb(), merchantId, parsed.data));
});
