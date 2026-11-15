import type { ComponentProps, ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  icon: ComponentType<{ className?: string }>;
  /** Texto accionable, p. ej. «Aún no tienes movimientos». */
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-4 py-10 text-center",
        className,
      )}
      {...props}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <p className="text-lg font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="text-base text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
