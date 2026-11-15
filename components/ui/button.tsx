import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Botones de DESIGN.md §5.
 * - `lg` (56 px, ancho completo) es el CTA principal: uno por vista.
 * - `md` (48 px) para acciones secundarias.
 * - `icon` cumple el objetivo táctil mínimo de 44 × 44 px.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-semibold",
    "transition-colors duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-60",
    "aria-disabled:pointer-events-none aria-disabled:opacity-60",
    "[&_svg]:size-5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-teal-700 active:bg-teal-700",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-teal-100/70 active:bg-teal-100/70",
        outline:
          "border border-border bg-surface text-foreground hover:bg-muted active:bg-muted",
        ghost:
          "bg-transparent text-teal-700 hover:bg-secondary active:bg-secondary",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-status-error/90 active:bg-status-error/90",
      },
      size: {
        lg: "h-14 w-full rounded-button text-base",
        md: "h-12 rounded-button px-5 text-base",
        icon: "size-11 rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "lg",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
