import type { ComponentProps, ComponentType } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Clock3,
  Info,
  TriangleAlert,
} from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
  {
    variants: {
      tone: {
        success: "bg-status-success-soft text-status-success",
        warning: "bg-status-warning-soft text-status-warning",
        error: "bg-status-error-soft text-status-error",
        info: "bg-status-info-soft text-status-info",
        incident: "bg-status-incident-soft text-status-incident",
        closed: "bg-status-closed-soft text-status-closed",
      },
    },
  },
);

export type StatusTone = NonNullable<
  VariantProps<typeof statusBadgeVariants>["tone"]
>;

/**
 * Ícono por tono. El check (`success`) está reservado a estados verificados:
 * nunca se usa para cobros pendientes (DESIGN.md §7).
 */
const toneIcons: Record<StatusTone, ComponentType<{ className?: string }>> = {
  success: CircleCheck,
  warning: Clock3,
  error: CircleAlert,
  info: Info,
  incident: TriangleAlert,
  closed: CircleMinus,
};

export type StatusBadgeProps = Omit<ComponentProps<"span">, "children"> & {
  tone: StatusTone;
  /** Etiqueta obligatoria: el estado nunca se comunica solo con color. */
  label: string;
};

export function StatusBadge({
  tone,
  label,
  className,
  ...props
}: StatusBadgeProps) {
  const Icon = toneIcons[tone];

  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </span>
  );
}
