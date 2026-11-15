import "server-only";
import { redirect } from "next/navigation";
import { loginUrl } from "@/lib/routes";
import { resolveMerchantContext } from "./session";
import type { MerchantContext } from "./types";

/**
 * Guarda para Server Components y Server Actions: devuelve el contexto del
 * comerciante o redirige a A01. Léela SIEMPRE junto a los datos que protege
 * (dentro de `<Suspense>`), no solo en el proxy ni en un layout.
 */
export async function requireMerchantContext(): Promise<MerchantContext> {
  const result = await resolveMerchantContext();

  if (result.status === "ok") {
    return result.context;
  }
  if (result.status === "no_merchant") {
    redirect(loginUrl({ reason: "sin-comercio" }));
  }
  redirect(loginUrl({ reason: "sesion-expirada" }));
}
