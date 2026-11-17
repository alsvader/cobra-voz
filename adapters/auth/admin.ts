import "server-only";

/**
 * Alta de usuarios ya confirmados, para el registro público.
 * Usa la clave secreta y solo se llama desde el servidor. No envía correo.
 * No reutiliza `scripts/db/auth-admin.ts`: ese módulo se niega a salir de local.
 */

export type SignupAuthConfig = { supabaseUrl: string; secretKey: string };

export type CreatedAuthUser = { id: string };

export type CreateAuthUserResult =
  | { ok: true; user: CreatedAuthUser }
  | { ok: false; reason: "email_exists" | "failed" };

export function readSignupAuthConfig(
  env: Record<string, string | undefined> = process.env,
): SignupAuthConfig | null {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !secretKey) return null;
  return { supabaseUrl, secretKey };
}

export async function createConfirmedAuthUser(
  config: SignupAuthConfig,
  input: { email: string; password: string },
  fetchImpl: typeof fetch = fetch,
): Promise<CreateAuthUserResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${config.supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: authHeaders(config),
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
      }),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  const body = (await response.json().catch(() => null)) as {
    id?: string;
    user?: { id?: string };
    error_code?: string;
    code?: string;
  } | null;

  if (response.ok) {
    const id = body?.id ?? body?.user?.id;
    if (id) return { ok: true, user: { id } };
    return { ok: false, reason: "failed" };
  }

  const code = body?.error_code ?? body?.code;
  if (
    response.status === 422 &&
    (code === "email_exists" || code === "user_already_exists")
  ) {
    return { ok: false, reason: "email_exists" };
  }
  return { ok: false, reason: "failed" };
}

/** Borra un usuario huérfano si el comercio no llegó a guardarse. */
export async function deleteAuthUser(
  config: SignupAuthConfig,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchImpl(`${config.supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: authHeaders(config),
    });
  } catch {
    // El alta ya falló. Un borrado imposible no cambia el mensaje.
  }
}

function authHeaders(config: SignupAuthConfig) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
    "Content-Type": "application/json",
  };
}
