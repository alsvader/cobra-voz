"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Cierra la sesión (revoca el refresh token) y vuelve a A01. */
export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
