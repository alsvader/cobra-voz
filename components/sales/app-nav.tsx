import Link from "next/link";
import { House, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

export function AppNav({ current }: { current: "inicio" | "ventas" }) {
  const item = (active: boolean) =>
    cn(
      "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-sm font-semibold",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label="Principal"
      className="sticky bottom-0 z-10 flex border-t border-border bg-canvas pb-[env(safe-area-inset-bottom)]"
    >
      <Link
        href={ROUTES.app}
        aria-current={current === "inicio" ? "page" : undefined}
        className={item(current === "inicio")}
      >
        <House aria-hidden="true" className="size-5" />
        Inicio
      </Link>
      <Link
        href={ROUTES.sales}
        aria-current={current === "ventas" ? "page" : undefined}
        className={item(current === "ventas")}
      >
        <ReceiptText aria-hidden="true" className="size-5" />
        Ventas
      </Link>
    </nav>
  );
}
