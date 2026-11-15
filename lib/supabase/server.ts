import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/config/public-env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Se crea uno NUEVO por petición (nunca compartido) y usa solo la
 * clave publicable: los privilegios los da la sesión del usuario.
 *
 * En Server Components no se pueden escribir cookies: el refresco de tokens
 * lo hace `proxy.ts`, por eso el `setAll` ignora ese caso.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: el proxy renueva la sesión.
        }
      },
    },
  });
}
