import { NextResponse, type NextRequest } from "next/server";
import { isPrivatePath, loginUrl } from "@/lib/routes";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy: renueva la sesión de Supabase y hace el redireccionamiento OPTIMISTA
 * de rutas privadas. No consulta la base de datos (corre en cada navegación y
 * prefetch). La autorización por comercio ocurre en `modules/identity`.
 *
 * Las rutas `/api` no redirigen: responden 401/403 por sí mismas.
 */
export async function proxy(request: NextRequest) {
  const update = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (isPrivatePath(pathname) && !update.claims) {
    const destination = new URL(
      loginUrl({
        next: `${pathname}${search}`,
        reason: update.hasAuthCookie ? "sesion-expirada" : undefined,
      }),
      request.url,
    );
    return redirectWithSession(update, destination);
  }

  return update.response ?? NextResponse.next();
}

export const config = {
  // Excluye estáticos, iconos y los archivos de la PWA (deben ser públicos).
  matcher: [
    "/((?!_next/static|_next/image|icons/|brand/|favicon.ico|icon.svg|apple-icon.png|opengraph-image|manifest.webmanifest|sw.js|offline.html).*)",
  ],
};
