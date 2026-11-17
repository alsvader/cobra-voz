"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createConfirmedAuthUser,
  deleteAuthUser,
  readSignupAuthConfig,
} from "@/adapters/auth/admin";
import { getDb } from "@/adapters/db/client";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type RegisterState } from "@/modules/identity/register-messages";
import { registerMerchant } from "@/modules/identity/register";
import { sharedBankAccountId } from "@/modules/merchant/shared-account";

/**
 * Crea un comercio con correo y contraseña. Next.js verifica el Origin.
 * No envía correo de verificación. La cuenta Pey sale de `PEY_BANK_ACCOUNT_ID`.
 */
export async function registerAction(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const kept = { name: name.trim(), email: email.trim() };

  const headerStore = await headers();
  const config = readSignupAuthConfig();
  const result = await registerMerchant(
    {
      db: getDb(),
      bankAccountId: sharedBankAccountId(process.env),
      rateKey: clientIp(headerStore),
      auth: {
        createConfirmedUser: async (input) => {
          if (!config) {
            console.error(
              JSON.stringify({ event: "register_auth_unconfigured" }),
            );
            return { ok: false, reason: "failed" };
          }
          const created = await createConfirmedAuthUser(config, input);
          if (!created.ok) return created;
          return { ok: true, id: created.user.id };
        },
        deleteUser: async (userId) => {
          if (config) await deleteAuthUser(config, userId);
        },
      },
    },
    { name, email, password },
  );

  if (!result.ok) return { ...kept, error: result.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.email,
    password,
  });
  if (error) return { ...kept, error: "created_sign_in_failed" };

  redirect(ROUTES.app);
}

function clientIp(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headerStore.get("x-real-ip")?.trim() || "unknown";
}
