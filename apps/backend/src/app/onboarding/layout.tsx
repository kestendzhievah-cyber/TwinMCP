import Link from "next/link";
import { Logo } from "@/components/marketing/logo";

// The onboarding screen is the card laid flat: the wordmark and its tagline on
// a bone bar with one hairline under it (DESIGN.md §4.1), the wizard on the
// stock, and one small-capitals address line along the bottom between the
// double rule and the page edge (§4.4) — real facts only.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="TwinMCP — home" className="inline-flex min-h-10 items-center">
            <Logo />
          </Link>
          <span className="eyebrow">Onboarding</span>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">{children}</div>
      </main>
      {/* Address line (DESIGN.md §4.4): one centred row of small caps under the
          double rule, items separated by a middle dot. */}
      <footer className="rule-double px-4 py-2 sm:px-6">
        <p className="smallcaps tracking-sc mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-3 text-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} TwinMCP</span>
          <span aria-hidden>·</span>
          <Link
            href="/docs"
            className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <span aria-hidden>·</span>
          <a
            href="mailto:hello@twinmcp.fr"
            className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
          >
            hello@twinmcp.fr
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://status.twinmcp.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
          >
            status.twinmcp.fr
          </a>
        </p>
      </footer>
    </div>
  );
}
