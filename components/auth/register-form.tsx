"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/(auth)/registro/actions";
import {
  registerErrorMessage,
  type RegisterState,
} from "@/modules/identity/register-messages";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";

const INITIAL_STATE: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    INITIAL_STATE,
  );
  const error = registerErrorMessage(state);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {error ? (
        <Notice tone="error" label="No se creó el comercio">
          {error}
        </Notice>
      ) : null}

      <TextField
        label="Nombre del comercio"
        name="name"
        autoComplete="organization"
        required
        defaultValue={state.name}
        disabled={pending}
      />
      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
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
        autoComplete="new-password"
        required
        minLength={8}
        disabled={pending}
        hint="Entre 8 y 72 caracteres. No te enviaremos un correo de verificación."
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Creando comercio…" : "Crear comercio"}
      </Button>
    </form>
  );
}
