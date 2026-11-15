"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealGroupProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Una sola entrada por grupo. Si el bloque ya está en pantalla al cargar,
 * no se esconde: el usuario ya lo vio. Solo anima lo que entra al hacer scroll.
 */
export function RevealGroup({ children, className }: RevealGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState<"idle" | "wait" | "in" | "shown">(
    "idle",
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setReveal("shown");
      return;
    }

    const rect = node.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.9 && rect.bottom > 40;
    if (inView) {
      setReveal("shown");
      return;
    }

    setReveal("wait");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setReveal("in");
        observer.disconnect();
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={reveal}
      className={cn("landing-reveal", className)}
    >
      {children}
    </div>
  );
}
