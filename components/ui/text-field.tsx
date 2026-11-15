import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  /** Label real y visible (DESIGN.md §9.8: nunca solo placeholder). */
  label: string;
  /** Mensaje de error descriptivo, debajo del campo. */
  error?: string;
  hint?: string;
};

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-foreground">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-md border bg-surface px-4 text-base text-foreground",
          "placeholder:text-ink-400 disabled:opacity-60",
          error ? "border-status-error" : "border-border",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
