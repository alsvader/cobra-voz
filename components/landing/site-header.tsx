import { headerLinks } from "@/components/landing/content";
import { LandingAnchor } from "@/components/landing/landing-anchor";
import { MobileNavigation } from "@/components/landing/mobile-navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 min-[360px]:px-5 lg:px-12">
        <LandingAnchor
          href="#inicio"
          className="cursor-pointer text-2xl font-bold text-foreground"
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
              className="cursor-pointer text-[15px] font-medium text-ink-600 transition-colors duration-150 ease-out hover:text-teal-700"
            >
              {link.label}
            </LandingAnchor>
          ))}
        </nav>
        <MobileNavigation />
      </div>
    </header>
  );
}
