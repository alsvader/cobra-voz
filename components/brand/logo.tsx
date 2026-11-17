import { cn } from "@/lib/utils";

/**
 * Logo horizontal principal (1015×300). El verde `#078C7B` vive en el SVG
 * y es distinto del teal de interfaz `#107B75`.
 * `max-w-none` y `self-start` evitan que el preflight y un contenedor
 * flex estiren el logo cuando la altura está fija.
 */
export function Logo({ className }: { className?: string }) {
  return (
    // El archivo es un SVG estático de marca. next/image no lo sirve sin
    // habilitar SVG de forma global.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logos/cobravoz-logo-primary.svg"
      alt="CobraVoz"
      width={1015}
      height={300}
      className={cn("h-8 w-auto max-w-none self-start", className)}
    />
  );
}
