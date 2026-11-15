/**
 * Errores de inicio de sesión que A01 sabe explicar al comerciante.
 * Mensajes concretos, sin jerga técnica ni detalles que ayuden a un atacante
 * (credenciales incorrectas y cuenta inexistente se ven igual).
 */
export type LoginErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "connection"
  | "rate_limited"
  | "no_merchant"
  | "unknown";

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  invalid_input: "Escribe tu correo y tu contraseña.",
  invalid_credentials:
    "Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.",
  connection:
    "No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.",
  rate_limited:
    "Hiciste muchos intentos. Espera un momento antes de volver a intentar.",
  no_merchant:
    "Tu cuenta todavía no tiene un comercio asignado. Contacta a quien configuró CobraVoz.",
  unknown: "No pudimos iniciar sesión. Inténtalo de nuevo en un momento.",
};

type AuthErrorLike = {
  name?: string;
  code?: string;
  status?: number;
};

export function classifyLoginError(error: AuthErrorLike): LoginErrorCode {
  if (error.code === "invalid_credentials" || error.code === "user_not_found") {
    return "invalid_credentials";
  }
  if (
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit" ||
    error.status === 429
  ) {
    return "rate_limited";
  }
  if (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    (typeof error.status === "number" && error.status >= 500)
  ) {
    return "connection";
  }
  return "unknown";
}

/** Motivos con los que se llega a A01 (`?motivo=`), con su aviso. */
export const LOGIN_REASON_MESSAGES = {
  "sesion-expirada": "Tu sesión expiró. Inicia sesión de nuevo para continuar.",
  "sin-comercio": LOGIN_ERROR_MESSAGES.no_merchant,
} as const;
