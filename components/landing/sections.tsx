import {
  Mic,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import {
  benefits,
  contactHref,
  contactPendingNote,
  finalCta,
  hero,
  howItWorks,
  trust,
  useCases,
} from "@/components/landing/content";
import { MarketingCTA } from "@/components/landing/marketing-cta";
import {
  BenefitVoicePreview,
  ConfirmAmountPreview,
  DailySummaryPreview,
  HomeScreenPreview,
  PaymentReceivedPreview,
  PaymentStatePreview,
  VoiceCapturePreview,
} from "@/components/landing/previews";
import { SectionContainer } from "@/components/landing/section-container";
import { SectionHeading } from "@/components/landing/section-heading";
import { StatusBadge } from "@/components/ui/status-badge";

const useCaseIcons = {
  utensils: UtensilsCrossed,
  store: Store,
  bag: ShoppingBag,
} as const;

function OrganicBlob({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-0 rounded-full bg-teal-100 ${className}`}
    />
  );
}

export function HeroSection() {
  return (
    <SectionContainer
      id="inicio"
      labelledBy="inicio-titulo"
      className="overflow-hidden pt-10 pb-16 lg:py-20"
      decor={
        <>
          <OrganicBlob className="top-24 -right-16 h-72 w-72 lg:top-16 lg:right-[6%] lg:h-[420px] lg:w-[420px]" />
          <OrganicBlob className="bottom-0 -left-24 h-48 w-48 lg:bottom-8 lg:left-auto lg:right-[18%] lg:h-56 lg:w-56" />
        </>
      }
    >
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,54fr)_minmax(0,46fr)] lg:gap-10">
        <div className="flex max-w-[540px] flex-col gap-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-700">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-teal-600"
            />
            {hero.eyebrow}
          </p>
          <h1
            id="inicio-titulo"
            className="text-balance text-[2rem] leading-[1.1] font-bold text-foreground min-[375px]:text-[2.25rem] min-[430px]:text-[2.5rem] lg:text-[3.5rem]"
          >
            {hero.title}
          </h1>
          <p className="text-base text-ink-600 lg:text-lg">
            {hero.description}
          </p>
          <div className="flex flex-col gap-3 lg:flex-row">
            <MarketingCTA href="#contacto" variant="primary">
              {hero.primaryCta}
            </MarketingCTA>
            <MarketingCTA href="#como-funciona" variant="secondary">
              {hero.secondaryCta}
            </MarketingCTA>
          </div>
        </div>
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute top-10 -right-6 -bottom-4 -left-8 -z-10 rounded-[48%_52%_46%_54%] bg-teal-100"
          />
          <HomeScreenPreview />
        </div>
      </div>
    </SectionContainer>
  );
}

const stepPreviews = [
  VoiceCapturePreview,
  ConfirmAmountPreview,
  PaymentReceivedPreview,
] as const;

export function HowItWorksSection() {
  return (
    <SectionContainer
      id="como-funciona"
      labelledBy="como-funciona-titulo"
      className="py-20 lg:py-28"
    >
      <SectionHeading
        id="como-funciona-titulo"
        eyebrow={howItWorks.eyebrow}
        title={howItWorks.title}
        description={howItWorks.description}
        align="center"
      />
      <ol className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6">
        {howItWorks.steps.map((step, index) => {
          const Preview = stepPreviews[index];
          if (!Preview) return null;
          return (
            <li
              key={step.number}
              className="flex flex-col gap-5 rounded-[20px] border border-border bg-surface p-5 shadow-card lg:p-7"
            >
              <div className="flex flex-col gap-3">
                <p className="text-sm font-bold text-teal-700">{step.number}</p>
                <h3 className="text-[1.375rem] leading-7 font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-[15px] text-ink-600 lg:text-base">
                  {step.description}
                </p>
              </div>
              <div className="mt-auto">
                <Preview />
              </div>
            </li>
          );
        })}
      </ol>
    </SectionContainer>
  );
}

export function BenefitsSection() {
  return (
    <SectionContainer
      id="beneficios"
      labelledBy="beneficios-titulo"
      className="overflow-hidden py-20 lg:py-28"
      decor={
        <OrganicBlob className="-top-10 -left-20 h-48 w-48 lg:h-64 lg:w-64" />
      }
    >
      <SectionHeading
        id="beneficios-titulo"
        eyebrow={benefits.eyebrow}
        title={benefits.title}
        description={benefits.description}
        align="center"
      />
      <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-2 lg:gap-6">
        <article className="flex flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-card lg:row-span-2">
          <div className="flex gap-4 p-5 lg:p-7">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <Mic aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="text-xl font-bold text-foreground lg:text-2xl">
                {benefits.primary.title}
              </h3>
              <p className="mt-2 text-[15px] text-ink-600 lg:text-base">
                {benefits.primary.description}
              </p>
            </div>
          </div>
          <div className="mt-auto px-6">
            <BenefitVoicePreview />
          </div>
        </article>
        <article className="rounded-[20px] border border-border bg-surface p-5 shadow-card lg:p-7">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {benefits.payments.title}
              </h3>
              <p className="mt-2 text-[15px] text-ink-600 lg:text-base">
                {benefits.payments.description}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <StatusBadge tone="warning" label="Esperando pago" />
            <StatusBadge tone="success" label="Pago recibido" />
          </div>
        </article>
        <article className="rounded-[20px] border border-border bg-surface p-5 shadow-card lg:p-7">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <ReceiptText aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {benefits.sales.title}
              </h3>
              <p className="mt-2 text-[15px] text-ink-600 lg:text-base">
                {benefits.sales.description}
              </p>
            </div>
          </div>
          <DailySummaryPreview
            totalLabel={benefits.sales.totalLabel}
            total={benefits.sales.total}
            count={benefits.sales.count}
            sample={benefits.sales.sample}
          />
        </article>
      </div>
    </SectionContainer>
  );
}

export function TrustSection() {
  return (
    <SectionContainer
      id="confianza"
      labelledBy="confianza-titulo"
      className="py-20 lg:py-28"
    >
      <div className="rounded-[28px] bg-teal-100 px-5 py-8 lg:grid lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:items-center lg:gap-16 lg:p-16">
        <div className="flex flex-col gap-6">
          <SectionHeading
            id="confianza-titulo"
            eyebrow={trust.eyebrow}
            title={trust.title}
            description={trust.description}
          />
          <div className="flex gap-3 rounded-[20px] bg-surface p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold text-teal-700">
                {trust.noticeTitle}
              </h3>
              <p className="mt-1 text-sm text-ink-600">{trust.notice}</p>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-6 lg:mt-0">
          <PaymentStatePreview
            tone="warning"
            label={trust.pending.label}
            amount={trust.pending.amount}
            detail={trust.pending.detail}
          />
          <PaymentStatePreview
            tone="success"
            label={trust.received.label}
            amount={trust.received.amount}
            detail={trust.received.detail}
            reference={trust.received.reference}
          />
        </div>
      </div>
    </SectionContainer>
  );
}

export function UseCasesSection() {
  return (
    <SectionContainer
      id="para-quien-es"
      labelledBy="para-quien-es-titulo"
      className="py-20 lg:py-24"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)] lg:gap-20">
        <div className="flex flex-col gap-6">
          <SectionHeading
            id="para-quien-es-titulo"
            eyebrow={useCases.eyebrow}
            title={useCases.title}
            description={useCases.description}
          />
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-700">
            <Smartphone aria-hidden="true" className="size-4" />
            {useCases.capsule}
          </p>
        </div>
        <ul className="flex flex-col gap-4 lg:gap-5">
          {useCases.cases.map((item) => {
            const Icon = useCaseIcons[item.icon];
            return (
              <li
                key={item.title}
                className="grid grid-cols-[3rem_1fr] items-center gap-x-4 gap-y-3 rounded-[20px] border border-border bg-surface p-5 shadow-card lg:items-start lg:p-6"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700 lg:row-span-2">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="text-xl font-bold text-foreground">
                  {item.title}
                </h3>
                <p className="col-span-2 text-[15px] text-ink-600 lg:col-span-1 lg:col-start-2 lg:text-base">
                  {item.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionContainer>
  );
}

export function FinalCTASection() {
  return (
    <SectionContainer
      id="contacto"
      labelledBy="contacto-titulo"
      className="py-16"
    >
      <div className="relative overflow-hidden rounded-[28px] bg-primary px-6 py-14 text-center lg:rounded-[32px] lg:px-20 lg:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-16 h-56 w-72 rounded-full bg-teal-700/45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-24 h-56 w-80 rounded-full bg-teal-700/35"
        />
        <div className="relative">
          <SectionHeading
            id="contacto-titulo"
            eyebrow={finalCta.eyebrow}
            title={finalCta.title}
            description={finalCta.description}
            align="center"
            tone="inverse"
          />
          <div className="mt-8">
            <MarketingCTA
              href={contactHref}
              variant="inverse"
              pendingNote={contactPendingNote}
              className="px-8"
            >
              {finalCta.cta}
            </MarketingCTA>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
