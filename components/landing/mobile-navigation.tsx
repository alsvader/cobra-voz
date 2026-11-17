"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Logo } from "@/components/brand/logo";
import { headerLinks, loginLink } from "@/components/landing/content";
import { LandingAnchor } from "@/components/landing/landing-anchor";

const coveredSelector = "main, footer, header .landing-header > a";

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
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const covered = document.querySelectorAll(coveredSelector);
    covered.forEach((node) => node.setAttribute("inert", ""));

    return () => {
      document.body.style.overflow = previousOverflow;
      covered.forEach((node) => node.removeAttribute("inert"));
    };
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

  function close() {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className={`relative z-[70] inline-flex size-11 cursor-pointer items-center justify-center ${open ? "text-teal-700" : "text-foreground"}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="landing-burger" data-open={open} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
      </button>
      <nav
        id={panelId}
        aria-label="Secciones"
        data-open={open}
        inert={!open}
        aria-hidden={!open}
        className="landing-menu fixed inset-0 z-50 flex flex-col bg-canvas px-4 pt-24 pb-[max(2rem,env(safe-area-inset-bottom))] min-[360px]:px-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full bg-teal-100"
        />
        <LandingAnchor
          href="#inicio"
          className="absolute top-0 left-0 flex h-16 items-center px-4 min-[360px]:px-5"
          onNavigate={close}
        >
          <Logo className="h-14" />
        </LandingAnchor>
        <ul className="relative flex flex-col">
          {headerLinks.map((link, index) => (
            <li
              key={link.href}
              className="landing-menu-item"
              style={
                { "--menu-delay": `${90 + index * 70}ms` } as CSSProperties
              }
            >
              <LandingAnchor
                href={link.href}
                className="flex min-h-16 cursor-pointer items-center text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-foreground transition-colors duration-150 ease-out-strong active:text-teal-700 min-[390px]:text-[2rem]"
                onNavigate={close}
              >
                {link.label}
              </LandingAnchor>
            </li>
          ))}
        </ul>
        <LandingAnchor
          href={loginLink.href}
          className="landing-menu-item relative mt-auto inline-flex h-14 cursor-pointer items-center justify-center rounded-button bg-primary text-base font-semibold text-primary-foreground"
          style={{ "--menu-delay": "320ms" } as CSSProperties}
          onNavigate={close}
        >
          {loginLink.label}
        </LandingAnchor>
      </nav>
    </div>
  );
}
