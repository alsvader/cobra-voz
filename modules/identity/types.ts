/** Contexto de un comerciante autenticado y autorizado. */
export type MerchantContext = {
  userId: string;
  email: string | null;
  merchantId: string;
};

export type MerchantContextResult =
  | { status: "ok"; context: MerchantContext }
  /** Sin sesión válida (no existe, expiró o fue revocada). */
  | { status: "unauthenticated" }
  /** Sesión válida, pero la cuenta no está vinculada a ningún comercio. */
  | { status: "no_merchant" };
