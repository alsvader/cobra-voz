"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { faq } from "@/components/landing/content";
import { SectionContainer } from "@/components/landing/section-container";
import { SectionHeading } from "@/components/landing/section-heading";

export function FAQSection() {
  const [openId, setOpenId] = useState<string | null>(faq.items[0].id);

  return (
    <SectionContainer
      id="preguntas-frecuentes"
      labelledBy="preguntas-frecuentes-titulo"
      className="py-20 lg:py-28"
    >
      <SectionHeading
        id="preguntas-frecuentes-titulo"
        eyebrow={faq.eyebrow}
        title={faq.title}
        description={faq.description}
        align="center"
      />
      <div className="mx-auto mt-10 flex max-w-[860px] flex-col gap-3">
        {faq.items.map((item) => {
          const open = openId === item.id;
          const panelId = `${item.id}-panel`;
          const buttonId = `${item.id}-button`;

          return (
            <div
              key={item.id}
              className="rounded-[16px] border border-border bg-surface px-5 py-2 shadow-card"
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left text-base font-semibold text-foreground transition-colors duration-150 ease-out hover:text-teal-700 lg:text-lg"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span>{item.question}</span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 transition-colors duration-150 ease-out group-hover:bg-primary group-hover:text-white">
                    {open ? (
                      <Minus aria-hidden="true" className="size-4" />
                    ) : (
                      <Plus aria-hidden="true" className="size-4" />
                    )}
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!open}
                className="border-t border-border pt-3 pb-4 text-[15px] text-ink-600 lg:text-base"
              >
                {item.answer}
              </div>
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
}
