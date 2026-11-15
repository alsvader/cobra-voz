"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LandingAnchor } from "@/components/landing/landing-anchor";

type MarketingCTAProps = {
  href?: string | null;
  children: ReactNode;
  variant: "primary" | "secondary" | "inverse";
  className?: string;
  pendingNote?: string;
  pendingNoteId?: string;
};

const variantClass = {
  primary:
    "w-full bg-primary text-primary-foreground hover:bg-teal-700 lg:w-auto",
  secondary:
    "w-full border border-border bg-surface text-teal-700 hover:bg-muted lg:w-auto",
  inverse: "w-full bg-surface text-teal-700 hover:bg-teal-100 lg:w-auto",
} as const;

export function MarketingCTA({
  href,
  children,
  variant,
  className,
  pendingNote,
  pendingNoteId = "contacto-pendiente",
}: MarketingCTAProps) {
  const classes = cn(
    "inline-flex h-14 cursor-pointer items-center justify-center rounded-button px-6 text-base font-semibold transition-colors duration-150 ease-out",
    variantClass[variant],
    className,
  );

  if (!href) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <button
          type="button"
          className={cn(classes, "cursor-not-allowed")}
          aria-disabled="true"
          aria-describedby={pendingNote ? pendingNoteId : undefined}
          onClick={(event) => event.preventDefault()}
        >
          {children}
        </button>
        {pendingNote ? (
          <p
            id={pendingNoteId}
            className={cn(
              "max-w-md text-center text-sm",
              variant === "inverse" ? "text-white" : "text-ink-600",
            )}
          >
            {pendingNote}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <LandingAnchor href={href} className={classes}>
      {children}
    </LandingAnchor>
  );
}
