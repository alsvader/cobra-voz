"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { headerLinks } from "@/components/landing/content";
import { LandingAnchor } from "@/components/landing/landing-anchor";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    function closeOnDesktop() {
      if (query.matches) setOpen(false);
    }
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-foreground"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <X aria-hidden="true" className="size-5" />
        ) : (
          <Menu aria-hidden="true" className="size-5" />
        )}
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
      </button>
      {open ? (
        <nav
          id={panelId}
          aria-label="Secciones"
          className="fixed inset-x-0 top-16 z-40 border-b border-border bg-canvas px-4 py-2 min-[360px]:px-5"
        >
          <ul>
            {headerLinks.map((link) => (
              <li key={link.href}>
                <LandingAnchor
                  href={link.href}
                  className="flex min-h-11 cursor-pointer items-center text-base font-medium text-foreground"
                  onNavigate={() => setOpen(false)}
                >
                  {link.label}
                </LandingAnchor>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
