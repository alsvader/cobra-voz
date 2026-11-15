"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { faq } from "@/components/landing/content";
import { staggerDelay } from "@/components/landing/motion";
import { RevealGroup } from "@/components/landing/reveal";
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
      <RevealGroup>
        <div className="landing-child">
          <SectionHeading
            id="preguntas-frecuentes-titulo"
            eyebrow={faq.eyebrow}
            title={faq.title}
            description={faq.description}
            align="center"
          />
        </div>
      </RevealGroup>
      <RevealGroup className="mx-auto mt-10 flex max-w-[860px] flex-col gap-3">
        {faq.items.map((item, index) => {
          const open = openId === item.id;
          const panelId = `${item.id}-panel`;
          const buttonId = `${item.id}-button`;

          return (
            <div
              key={item.id}
              className="landing-object rounded-[16px] border border-border bg-surface px-5 py-2 shadow-card"
              style={staggerDelay(index)}
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  className="landing-press group flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left text-base font-semibold text-foreground hover:text-teal-700 lg:text-lg"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span>{item.question}</span>
                  <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 transition-colors duration-150 ease-out-strong group-hover:bg-primary group-hover:text-white">
                    <Plus
                      aria-hidden="true"
                      className={`landing-faq-icon absolute size-4 ${open ? "opacity-0" : "opacity-100"}`}
                    />
                    <Minus
                      aria-hidden="true"
                      className={`landing-faq-icon absolute size-4 ${open ? "opacity-100" : "opacity-0"}`}
                    />
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                data-open={open}
                aria-hidden={!open}
                inert={!open}
                className="landing-faq-panel"
              >
                <div className="landing-faq-clip">
                  <div className="border-t border-border pt-3 pb-4 text-[15px] text-ink-600 lg:text-base">
                    {item.answer}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </RevealGroup>
    </SectionContainer>
  );
}
