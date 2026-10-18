import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { Logo } from "@/components/marketing/logo";

// The auth screen is the card laid flat: the wordmark on a hairline bar, the
// form dead-centre on bone stock, one small-capitals address line along the
// bottom and, on wide screens, the product figure on the reverse (DESIGN.md §4).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[3fr_2fr]">
      {/* Form side */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" aria-label="TwinMCP — home" className="inline-flex min-h-10 items-center">
            <Logo />
          </Link>
        </header>
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-10"
        >
          <div className="w-full max-w-sm">{children}</div>
        </main>
        {/* Address line (DESIGN.md §4.4): one centred row of small caps under the
            double rule, items separated by a middle dot — real facts only. */}
        <footer className="rule-double px-4 py-2 sm:px-6 lg:px-10">
          <p className="smallcaps tracking-sc flex flex-wrap items-center justify-center gap-x-3 text-center text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} TwinMCP</span>
            <span aria-hidden>·</span>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/plans"
              className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
            >
              Pricing
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

      {/* Panel side (hidden on mobile) */}
      <div className="hidden lg:block">
        <AuthPanel />
      </div>
    </div>
  );
}
