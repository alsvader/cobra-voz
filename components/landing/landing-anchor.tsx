"use client";

import type { ComponentProps } from "react";

type LandingAnchorProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  onNavigate?: () => void;
};

/**
 * Ancla de la misma página. Mueve el foco al destino y respeta
 * prefers-reduced-motion. El href sigue funcionando sin JavaScript.
 */
export function LandingAnchor({
  href,
  onNavigate,
  onClick,
  ...props
}: LandingAnchorProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onNavigate?.();

        const id = href.startsWith("#") ? href.slice(1) : "";
        const target = document.getElementById(id);
        if (!target) return;

        event.preventDefault();
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        target.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
        target.focus({ preventScroll: true });
        history.pushState(null, "", href);
      }}
      {...props}
    />
  );
}
