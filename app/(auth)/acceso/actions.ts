"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/adapters/db/client";
import {
  classifyLoginError,
  type LoginErrorCode,
} from "@/modules/identity/login-errors";
import { findMerchantIdForUser } from "@/modules/identity/merchant-access";
import { ROUTES, sanitizeNextPath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: LoginErrorCode;
  /** Se conserva para no obligar a reescribir el correo tras un error. */
  email?: string;
};

const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});

/**
 * Inicia sesión con correo y contraseña (Supabase Auth). Es un Server Action:
 * Next.js ya verifica que el `Origin` coincida con el host (CSRF).
 * Entran las cuentas vinculadas a un comercio, incluidas las que se crean
 * en `/registro`.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "").trim();

  if (!parsed.success) {
    return { error: "invalid_input", email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { error: error ? classifyLoginError(error) : "unknown", email };
  }

  // Una cuenta sin comercio no debe quedar con sesión abierta.
  const merchantId = await findMerchantIdForUser(getDb(), data.user.id);
  if (!merchantId) {
    await supabase.auth.signOut();
    return { error: "no_merchant", email };
  }

  const next = sanitizeNextPath(String(formData.get("siguiente") ?? ""));
  redirect(next ?? ROUTES.app);
}
