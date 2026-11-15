"use client";

import type { ComponentProps } from "react";
import { TextField } from "@/components/ui/text-field";

export type AmountInputProps = Omit<
  ComponentProps<typeof TextField>,
  "label" | "type" | "inputMode" | "hint"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Campo manual de importe (DESIGN.md §6.3): teclado decimal, etiqueta visible y
 * error debajo. No es `type=number`: el dinero se interpreta con
 * `parseAmountToCents`, que trabaja con texto y centavos enteros.
 */
export function AmountInput({
  value,
  onValueChange,
  ...props
}: AmountInputProps) {
  return (
    <TextField
      label="Importe a cobrar (MXN)"
      hint="Escribe pesos y, si hace falta, centavos con punto. Ejemplo: 150.50"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint="done"
      maxLength={14}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      {...props}
    />
  );
}
