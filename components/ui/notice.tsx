import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const noticeVariants = cva("flex flex-col gap-3 rounded-lg border p-4", {
  variants: {
    tone: {
      success: "border-status-success/20 bg-status-success-soft",
      warning: "border-status-warning/20 bg-status-warning-soft",
      error: "border-status-error/20 bg-status-error-soft",
      info: "border-status-info/20 bg-status-info-soft",
      incident: "border-status-incident/20 bg-status-incident-soft",
      closed: "border-border bg-status-closed-soft",
    },
  },
});

export type NoticeProps = Omit<ComponentProps<"div">, "title"> &
  VariantProps<typeof noticeVariants> & {
    tone: StatusTone;
    /** Etiqueta de estado visible (ícono + texto). */
    label: string;
    /** Una sola idea, en lenguaje directo y sin jerga técnica. */
    children: ReactNode;
    /** Una acción relevante como máximo. */
    action?: ReactNode;
  };

/**
 * Aviso de una sola idea (DESIGN.md §6.8). Los errores se anuncian como
 * `alert`; el resto como `status` con `aria-live="polite"`.
 */
export function Notice({
  tone,
  label,
  children,
  action,
  className,
  ...props
}: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(noticeVariants({ tone }), className)}
      {...props}
    >
      <StatusBadge
        tone={tone}
        label={label}
        className="self-start bg-transparent px-0"
      />
      <p className="text-base text-foreground">{children}</p>
      {action}
    </div>
  );
}
