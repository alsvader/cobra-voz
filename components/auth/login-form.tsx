"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/(auth)/acceso/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { LOGIN_ERROR_MESSAGES } from "@/modules/identity/login-errors";

const INITIAL_STATE: LoginState = {};

export function LoginForm({
  next,
  notice,
}: {
  /** Ruta privada a la que volver tras entrar (ya saneada en el servidor). */
  next?: string;
  /** Aviso previo, p. ej. «Tu sesión expiró». */
  notice?: string;
}) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    INITIAL_STATE,
  );
  const error = state.error ? LOGIN_ERROR_MESSAGES[state.error] : undefined;
  const connectionProblem = state.error === "connection";

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {notice && !error ? (
        <Notice tone="info" label="Inicia sesión">
          {notice}
        </Notice>
      ) : null}

      {error ? (
        <Notice
          tone="error"
          label={connectionProblem ? "Sin conexión" : "No pudimos entrar"}
        >
          {error}
        </Notice>
      ) : null}

      <input type="hidden" name="siguiente" value={next ?? ""} />

      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.email}
        disabled={pending}
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        disabled={pending}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
