"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = Omit<
  ComponentProps<"button">,
  "role" | "onChange" | "children"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * Interruptor accesible (`role="switch"`). El estado se comunica con la
 * posición del control y con `aria-checked`; la etiqueta visible la pone quien
 * lo usa. Objetivo táctil de 44 px de alto (DESIGN.md §5.2).
 */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-11 w-16 shrink-0 items-center rounded-full",
        "transition-colors duration-150 ease-out disabled:opacity-60",
        checked ? "bg-primary" : "bg-ink-400",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-8 rounded-full bg-white shadow-card",
          "transition-transform duration-150 ease-out",
          checked ? "translate-x-[30px]" : "translate-x-1",
        )}
      />
    </button>
  );
}
