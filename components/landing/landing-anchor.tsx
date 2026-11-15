"use client";

import type { ComponentProps } from "react";

type LandingAnchorProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  onNavigate?: () => void;
};

/**
 * Enlace de la landing. Las anclas (`#…`) mueven el foco al destino y
 * respetan prefers-reduced-motion. Una ruta de la app (por ejemplo
 * `/acceso`) se deja al navegador. El href funciona sin JavaScript.
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
        if (!href.startsWith("#")) return;

        const target = document.getElementById(href.slice(1));
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
