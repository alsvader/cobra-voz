import "server-only";
import { isMutation, isSameOrigin } from "@/lib/security/origin";
import { errorJson, PRIVATE_CACHE_CONTROL } from "@/lib/security/responses";
import { resolveMerchantContext } from "./session";
import type { MerchantContext } from "./types";

type MerchantRouteHandler<RouteContext> = (
  request: Request,
  context: MerchantContext,
  route: RouteContext,
) => Promise<Response> | Response;

/**
 * Envuelve un Route Handler privado. Garantiza, antes de ejecutar el handler:
 *  1. Mutaciones solo desde el mismo origen (CSRF; los Route Handlers no lo
 *     comprueban por sí solos).
 *  2. Sesión verificada → 401 si falta o expiró.
 *  3. Pertenencia a un comercio → 403 si la cuenta no tiene ninguno.
 * El handler recibe el `merchantId` DERIVADO de la sesión; nunca lo toma del
 * cuerpo ni de la URL. Todas las respuestas salen como no cacheables.
 */
export function withMerchantApi<RouteContext = unknown>(
  handler: MerchantRouteHandler<RouteContext>,
) {
  return async (request: Request, route: RouteContext): Promise<Response> => {
    if (isMutation(request.method) && !isSameOrigin(request)) {
      return errorJson(
        403,
        "invalid_origin",
        "Origen de la petición no permitido.",
      );
    }

    const result = await resolveMerchantContext();
    if (result.status === "unauthenticated") {
      return errorJson(401, "unauthenticated", "Inicia sesión para continuar.");
    }
    if (result.status === "no_merchant") {
      return errorJson(
        403,
        "no_merchant",
        "Tu cuenta no tiene un comercio asignado.",
      );
    }

    const response = await handler(request, result.context, route);
    // Defensa en profundidad: aunque el handler olvide las cabeceras.
    response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
    return response;
  };
}
