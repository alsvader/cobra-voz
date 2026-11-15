import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/config/public-env";

export type SessionUpdate = {
  /** Respuesta con las cookies renovadas; úsala o copia sus cookies. */
  response: NextResponse;
  /** Claims del JWT verificado, o null si no hay sesión válida. */
  claims: { sub?: string } | null;
  /** Hay cookie de sesión (válida o no): distingue «sin sesión» de «sesión expirada». */
  hasAuthCookie: boolean;
};

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Renueva la sesión de Supabase en cada petición y devuelve su estado.
 *
 * Es un chequeo OPTIMISTA para redirigir pronto: la autorización real se
 * repite junto a los datos (`modules/identity`), nunca solo aquí.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  const { url, publishableKey } = getSupabasePublicConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cabeceras anti-caché para que un CDN no sirva la sesión de otro usuario.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => AUTH_COOKIE.test(cookie.name));

  // `getClaims` verifica la firma del JWT y renueva el token si caducó.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null, hasAuthCookie };
}

/** Redirige conservando las cookies de sesión recién renovadas. */
export function redirectWithSession(
  update: SessionUpdate,
  destination: URL,
): NextResponse {
  const redirect = NextResponse.redirect(destination);
  for (const cookie of update.response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  update.response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "cache-control" || key.toLowerCase() === "pragma" || key.toLowerCase() === "expires") {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}
