import type { CSSProperties } from "react";

/** Retrasos no uniformes: el salto crece un poco y se queda corto. */
const STAGGER_MS = [0, 90, 190, 300, 420, 540] as const;

export function revealDelay(ms: number): CSSProperties {
  return { "--reveal-delay": `${ms}ms` } as CSSProperties;
}

export function staggerDelay(index: number): CSSProperties {
  return revealDelay(STAGGER_MS[index] ?? STAGGER_MS[STAGGER_MS.length - 1]);
}
