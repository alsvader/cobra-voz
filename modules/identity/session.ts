import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/adapters/db/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMerchantIdForUser } from "./merchant-access";
import type { MerchantContextResult } from "./types";

/**
 * Resuelve quién es el usuario y a qué comercio pertenece.
 *
 * Usa `auth.getUser()`, que consulta al servidor de Auth y por tanto detecta
 * sesiones revocadas o eliminadas; las cookies por sí solas no se confían.
 * `cache` deduplica la consulta dentro de una misma petición.
 */
export const resolveMerchantContext = cache(
  async (): Promise<MerchantContextResult> => {
    // La sesión es por petición y el cliente de Auth lee el reloj (`Date.now()`):
    // se marca como dinámico para que nunca se intente prerenderizar.
    await connection();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { status: "unauthenticated" };
    }

    const merchantId = await findMerchantIdForUser(getDb(), data.user.id);
    if (!merchantId) {
      return { status: "no_merchant" };
    }

    return {
      status: "ok",
      context: {
        userId: data.user.id,
        email: data.user.email ?? null,
        merchantId,
      },
    };
  },
);
