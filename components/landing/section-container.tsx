import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionContainerProps = {
  id: string;
  labelledBy?: string;
  className?: string;
  innerClassName?: string;
  decor?: ReactNode;
  children: ReactNode;
};

export function SectionContainer({
  id,
  labelledBy,
  className,
  innerClassName,
  decor,
  children,
}: SectionContainerProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={cn("relative scroll-mt-24 outline-none", className)}
    >
      {decor}
      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-[1200px] px-4 min-[360px]:px-5 lg:px-12",
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
