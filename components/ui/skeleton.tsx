import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Bloque discreto de carga. La animación se anula con `prefers-reduced-motion`. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
