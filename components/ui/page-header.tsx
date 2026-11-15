import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export type PageHeaderProps = {
  title: string;
  /** Destino del «Volver». */
  backHref: string;
  backLabel?: string;
  action?: ReactNode;
};

/** Encabezado con «Volver» para pantallas secundarias (A02, A03, P02). */
export function PageHeader({
  title,
  backHref,
  backLabel = "Volver",
  action,
}: PageHeaderProps) {
  return (
    <header className="flex min-h-16 items-center gap-2 px-2 min-[360px]:px-3">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
      </Link>
      <h1 className="flex-1 text-xl font-bold text-foreground">{title}</h1>
      {action}
    </header>
  );
}
