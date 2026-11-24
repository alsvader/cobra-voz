import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * Atajo al historial completo. El texto visible es corto para caber junto
 * al título de la sección; el nombre accesible conserva la frase completa.
 */
export function AllSalesLink() {
  return (
    <Link
      href={ROUTES.sales}
      aria-label="Ver todas las ventas"
      className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-teal-700 underline-offset-4 hover:text-teal-600 hover:underline"
    >
      Ver todas
    </Link>
  );
}
