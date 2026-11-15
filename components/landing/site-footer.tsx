import type { CSSProperties } from "react";
import {
  footer,
  footerExplore,
  footerHelp,
  privacyHref,
  privacyPendingNote,
} from "@/components/landing/content";
import { LandingAnchor } from "@/components/landing/landing-anchor";
import { revealDelay } from "@/components/landing/motion";
import { RevealGroup } from "@/components/landing/reveal";

function FooterLinks({
  id,
  title,
  links,
  className,
  style,
}: {
  id: string;
  title: string;
  links: readonly { href: string; label: string }[];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <nav aria-labelledby={id} className={className} style={style}>
      <p id={id} className="text-base font-bold text-foreground">
        {title}
      </p>
      <ul className="mt-3">
        {links.map((link) => (
          <li key={link.href}>
            <LandingAnchor
              href={link.href}
              className="inline-flex min-h-11 cursor-pointer items-center text-[15px] text-ink-600 transition-colors duration-150 ease-out-strong hover:text-teal-700"
            >
              {link.label}
            </LandingAnchor>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer id="footer" className="border-t border-border bg-canvas">
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-12 pb-8 min-[360px]:px-5 lg:px-12 lg:pt-[72px]">
        <RevealGroup className="flex flex-col gap-10 lg:grid lg:grid-cols-4 lg:gap-16">
          <div className="landing-child lg:col-span-2">
            <LandingAnchor
              href="#inicio"
              className="cursor-pointer text-[28px] leading-none font-bold text-foreground transition-colors duration-150 ease-out-strong hover:text-teal-700"
            >
              {footer.wordmark}
            </LandingAnchor>
            <p className="mt-3 max-w-sm text-base text-ink-600">
              {footer.slogan}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 lg:contents">
            <FooterLinks
              id="footer-explora"
              title={footer.explore}
              links={footerExplore}
              className="landing-child"
              style={revealDelay(120)}
            />
            <FooterLinks
              id="footer-ayuda"
              title={footer.help}
              links={footerHelp}
              className="landing-child"
              style={revealDelay(240)}
            />
          </div>
        </RevealGroup>
        <RevealGroup>
          <div className="landing-child mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
            <p className="text-sm text-ink-600">{footer.copyright}</p>
            {privacyHref ? (
              <a
                href={privacyHref}
                className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-teal-700 underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-teal-600 hover:underline"
              >
                {footer.privacy}
              </a>
            ) : (
              <p className="text-sm text-ink-600">
                {footer.privacy}
                <span className="sr-only">. {privacyPendingNote}</span>
              </p>
            )}
          </div>
        </RevealGroup>
      </div>
    </footer>
  );
}
