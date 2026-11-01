import Link from "next/link";
import { Logo } from "@/components/marketing/logo";
import { STATUS_URL, displayHost } from "@/lib/site-links";

const FOOTER_LINK =
  "inline-flex min-h-10 items-center transition-colors hover:text-foreground focus-visible:text-foreground";

// The onboarding screen (docs/DESIGN.md, "Onboarding"): its own light-blue
// page, the logo on top, the wizard as one centred card (max-w-2xl) and one
// address line at the bottom (real facts only). English only, like the
// dashboard it leads to.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="TwinMCP, home"
            className="inline-flex min-h-10 items-center rounded-lg"
          >
            <Logo mark tagline={false} />
          </Link>
          <span className="eyebrow">Getting started</span>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">{children}</div>
      </main>
      {/* Address line: one centred row, items separated by a middle dot. */}
      <footer className="border-t border-border px-4 py-2 sm:px-6">
        <p className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-3 text-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} TwinMCP</span>
          <span aria-hidden>·</span>
          <Link href="/docs" className={FOOTER_LINK}>
            Docs
          </Link>
          <span aria-hidden>·</span>
          <a href="mailto:hello@twinmcp.fr" className={FOOTER_LINK}>
            hello@twinmcp.fr
          </a>
          {STATUS_URL && (
            <>
              <span aria-hidden>·</span>
              <a
                href={STATUS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK}
              >
                {displayHost(STATUS_URL)}
              </a>
            </>
          )}
        </p>
        <p className="pb-2 text-center text-xs text-muted-foreground">
          Logos are trademarks of their respective owners; their use does not imply endorsement.
        </p>
      </footer>
    </div>
  );
}
