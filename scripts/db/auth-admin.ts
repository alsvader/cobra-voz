/**
 * Utilidades de la API admin de Supabase Auth (GoTrue) para entornos LOCALES:
 * seed, pruebas de integración y E2E. Usa la clave secreta, así que se niega a
 * apuntar a una instancia que no sea local. No lo importes desde código de la app.
 */
import { authAdminHeaders } from "../../adapters/auth/headers";
import { isLocalUrl } from "./local-guard";

export type AuthUser = { id: string; email?: string };

export type AuthAdminConfig = { supabaseUrl: string; secretKey: string };

export function readAuthAdminConfig(
  env: Record<string, string | undefined> = process.env,
): AuthAdminConfig {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY. Ejecuta npm run db:env.",
    );
  }
  if (!isLocalUrl(supabaseUrl)) {
    throw new Error("Operación rechazada: Supabase no es local.");
  }
  return { supabaseUrl, secretKey };
}

function headers({ secretKey }: AuthAdminConfig) {
  return authAdminHeaders(secretKey);
}

export class AuthAdminError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AuthAdminError";
  }
}

export async function createAuthUser(
  config: AuthAdminConfig,
  input: { email: string; password: string },
): Promise<AuthUser> {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ ...input, email_confirm: true }),
  });

  if (response.ok) {
    return (await response.json()) as AuthUser;
  }

  const error = (await response.json().catch(() => ({}))) as {
    error_code?: string;
    msg?: string;
  };
  throw new AuthAdminError(
    `No se pudo crear el usuario (${response.status}): ${error.msg ?? "sin detalle"}`,
    error.error_code,
  );
}

export async function findAuthUserByEmail(
  config: AuthAdminConfig,
  email: string,
): Promise<AuthUser | undefined> {
  const response = await fetch(
    `${config.supabaseUrl}/auth/v1/admin/users?per_page=200`,
    { headers: headers(config) },
  );
  const { users } = (await response.json()) as { users: AuthUser[] };
  return users.find((user) => user.email === email);
}

/** Crea el usuario o reutiliza el existente con ese correo. */
export async function ensureAuthUser(
  config: AuthAdminConfig,
  input: { email: string; password: string },
): Promise<AuthUser> {
  try {
    return await createAuthUser(config, input);
  } catch (error) {
    if (!(error instanceof AuthAdminError) || error.code !== "email_exists") {
      throw error;
    }
    const existing = await findAuthUserByEmail(config, input.email);
    if (!existing) {
      throw new AuthAdminError("El usuario existe pero no se pudo localizar.");
    }
    return existing;
  }
}

export async function deleteAuthUser(
  config: AuthAdminConfig,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${config.supabaseUrl}/auth/v1/admin/users/${userId}`,
    { method: "DELETE", headers: headers(config) },
  );
  if (!response.ok && response.status !== 404) {
    throw new AuthAdminError(
      `No se pudo borrar el usuario (${response.status}).`,
    );
  }
}
