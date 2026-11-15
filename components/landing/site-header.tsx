import { headerLinks, loginLink } from "@/components/landing/content";
import { LandingAnchor } from "@/components/landing/landing-anchor";
import { MobileNavigation } from "@/components/landing/mobile-navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas">
      <div className="landing-header mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 min-[360px]:px-5 lg:px-12">
        <LandingAnchor
          href="#inicio"
          className="cursor-pointer text-2xl font-bold text-foreground transition-colors duration-150 ease-out-strong hover:text-teal-700"
        >
          CobraVoz
        </LandingAnchor>
        <nav
          aria-label="Secciones"
          className="hidden items-center gap-8 lg:flex"
        >
          {headerLinks.map((link) => (
            <LandingAnchor
              key={link.href}
              href={link.href}
              className="landing-nav-link cursor-pointer text-[15px] font-medium text-ink-600 transition-colors duration-150 ease-out-strong hover:text-teal-700"
            >
              {link.label}
            </LandingAnchor>
          ))}
          <LandingAnchor
            href={loginLink.href}
            className="inline-flex h-11 cursor-pointer items-center rounded-button bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors duration-150 ease-out-strong hover:bg-teal-700"
          >
            {loginLink.label}
          </LandingAnchor>
        </nav>
        <MobileNavigation />
      </div>
    </header>
  );
}
