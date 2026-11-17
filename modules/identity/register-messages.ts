import type { RegistrationError } from "./register";

export type RegisterState = {
  error?: RegistrationError | "created_sign_in_failed";
  name?: string;
  email?: string;
};

export const REGISTER_ERROR_MESSAGES: Record<RegistrationError, string> = {
  invalid_name: "Escribe el nombre del comercio, entre 2 y 80 caracteres.",
  invalid_email: "Escribe un correo válido.",
  invalid_password: "Usa una contraseña de 8 a 72 caracteres.",
  email_taken: "Ya hay una cuenta con ese correo. Inicia sesión.",
  rate_limited:
    "Hiciste varios registros. Espera un momento antes de volver a intentar.",
  account_not_configured:
    "El registro no está disponible en este momento. Inténtalo más tarde.",
  unavailable:
    "No pudimos crear el comercio. Inténtalo de nuevo en un momento.",
};

export const REGISTER_CREATED_SIGN_IN_FAILED =
  "Tu comercio quedó creado. Inicia sesión para continuar.";

export function registerErrorMessage(state: RegisterState): string | undefined {
  if (state.error === "created_sign_in_failed") {
    return REGISTER_CREATED_SIGN_IN_FAILED;
  }
  if (!state.error) return undefined;
  return REGISTER_ERROR_MESSAGES[state.error];
}
