import { FAQSection } from "@/components/landing/faq-section";
import {
  BenefitsSection,
  FinalCTASection,
  HeroSection,
  HowItWorksSection,
  TrustSection,
  UseCasesSection,
} from "@/components/landing/sections";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <a
        href="#inicio"
        className="absolute top-4 left-4 z-50 -translate-y-24 rounded-button bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground opacity-0 transition-colors duration-150 ease-out hover:bg-teal-700 focus:translate-y-0 focus:opacity-100"
      >
        Saltar al contenido
      </a>
      <SiteHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <BenefitsSection />
        <TrustSection />
        <UseCasesSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <SiteFooter />
    </div>
  );
}
