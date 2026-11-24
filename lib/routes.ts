export const ROUTES = {
  home: "/",
  login: "/acceso",
  register: "/registro",
  app: "/inicio",
  settings: "/configuracion",
  /** Recorrido de cobro: P02 (`/cobro/confirmar`) y P03 (`/cobro/[id]`). */
  charge: "/cobro",
  confirmAmount: "/cobro/confirmar",
  /** P04 Ventas y A03 Detalle (`/ventas/[id]`). */
  sales: "/ventas",
  /** QR fijo del mostrador. El cliente escribe el importe. */
  counter: "/mostrador",
  /** El cliente llega aquí después de pagar un enlace. No marca el cobro. */
  paymentLinkPaid: "/enlace/pago-completado",
  /** El cliente llega aquí si cancela o regresa del enlace. */
  paymentLinkCancelled: "/enlace/pago-cancelado",
} as const;

/** P03 — Cobro CoDi de un cobro concreto. */
export function chargePath(chargeId: string): string {
  return `${ROUTES.charge}/${chargeId}`;
}

export type SaleOrigin = "inicio" | "ventas" | "cobro" | "mostrador";

/** A03. `from` dice a dónde vuelve «Volver»; solo se aceptan esos orígenes. */
export function salePath(chargeId: string, from?: SaleOrigin): string {
  const path = `${ROUTES.sales}/${chargeId}`;
  return from ? `${path}?desde=${from}` : path;
}

export function saleOrigin(raw: string | undefined): SaleOrigin {
  if (raw === "inicio" || raw === "cobro" || raw === "mostrador") return raw;
  return "ventas";
}

/** Rutas privadas (requieren sesión). */
export const PRIVATE_PATH_PREFIXES: readonly string[] = [
  ROUTES.app,
  ROUTES.settings,
  ROUTES.charge,
  ROUTES.sales,
  ROUTES.counter,
];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Destino al que volver tras iniciar sesión. Solo se aceptan rutas privadas
 * propias: cualquier otra cosa (URL absoluta, `//host`, esquemas, `\`) se
 * descarta para evitar open redirects.
 */
export function sanitizeNextPath(
  raw: string | null | undefined,
): string | null {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\")
  ) {
    return null;
  }
  try {
    const url = new URL(raw, "http://cobravoz.invalid");
    if (
      url.origin !== "http://cobravoz.invalid" ||
      !isPrivatePath(url.pathname)
    ) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export type LoginReason = "sesion-expirada" | "sin-comercio";

export function loginUrl(
  options: { next?: string; reason?: LoginReason } = {},
) {
  const params = new URLSearchParams();
  if (options.reason) params.set("motivo", options.reason);
  const next = sanitizeNextPath(options.next);
  if (next) params.set("siguiente", next);
  const query = params.toString();
  return query ? `${ROUTES.login}?${query}` : ROUTES.login;
}
