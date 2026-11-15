import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "default" | "inverse";
  titleClassName?: string;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  tone = "default",
  titleClassName,
}: SectionHeadingProps) {
  const inverse = tone === "inverse";

  return (
    <div
      className={cn(
        "flex max-w-[720px] flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold tracking-[0.06em]",
          inverse ? "text-white" : "text-teal-700",
        )}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className={cn(
          "text-balance text-[2rem] leading-[1.15] font-bold min-[390px]:text-[2.125rem] lg:text-[2.75rem]",
          inverse ? "text-white lg:text-[3.25rem]" : "text-foreground",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-[640px] text-base lg:text-lg",
            inverse ? "text-white" : "text-ink-600",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
