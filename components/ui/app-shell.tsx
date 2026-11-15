import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppShellProps = Omit<ComponentProps<"div">, "children"> & {
  header?: ReactNode;
  /** Barra inferior: solo P01 y P04 (UX §2). P02/P03 no la reciben. */
  bottomNav?: ReactNode;
  children: ReactNode;
};

/**
 * Contenedor móvil de DESIGN.md §6.1: ancho máximo 480 px centrado, padding
 * lateral de 16 px (≥360 px: 20 px) y zona segura inferior de iOS.
 */
export function AppShell({
  header,
  bottomNav,
  children,
  className,
  ...props
}: AppShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-shell flex-1 flex-col bg-canvas",
        className,
      )}
      {...props}
    >
      {header}
      <main
        className={cn(
          "flex flex-1 flex-col px-4 min-[360px]:px-5",
          bottomNav ? "pb-6" : "pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </main>
      {bottomNav}
    </div>
  );
}
