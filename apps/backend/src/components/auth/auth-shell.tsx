import Link from "next/link";
import type { Route } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { AuthLanguageSwitcher } from "@/components/auth/auth-language-switcher";
import { Logo } from "@/components/marketing/logo";
import type { Locale } from "@/lib/i18n/locales";
import { STATUS_URL, displayHost } from "@/lib/site-links";

const COPY = {
  en: {
    homeHref: "/",
    homeLabel: "TwinMCP — home",
    home: "Home",
    pricing: "Pricing",
    pricingHref: "/plans",
  },
  fr: {
    homeHref: "/fr",
    homeLabel: "TwinMCP — accueil",
    home: "Accueil",
    pricing: "Tarifs",
    pricingHref: "/fr/tarifs",
  },
} as const;

// The auth screen is the card laid flat: the wordmark on a hairline bar, the
// form dead-centre on bone stock, one small-capitals address line along the
// bottom and, on wide screens, the product figure on the reverse (DESIGN.md §4).
// Shared by the English (auth) group and the French (auth-fr) group.
export function AuthShell({
  locale = "en",
  children,
}: {
  locale?: Locale;
  children: React.ReactNode;
}) {
  const t = COPY[locale];
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[3fr_2fr]">
      {/* Form side */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href={t.homeHref as Route}
            aria-label={t.homeLabel}
            className="inline-flex min-h-10 items-center"
          >
            <Logo />
          </Link>
          {/* EN · FR on the sign-in / sign-up / forgot-password pairs (hidden elsewhere). */}
          <AuthLanguageSwitcher locale={locale} />
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
              href={t.homeHref as Route}
              className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
            >
              {t.home}
            </Link>
            <span aria-hidden>·</span>
            <Link
              href={t.pricingHref as Route}
              className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
            >
              {t.pricing}
            </Link>
            <span aria-hidden>·</span>
            <a
              href="mailto:hello@twinmcp.fr"
              className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
            >
              hello@twinmcp.fr
            </a>
            {STATUS_URL && (
              <>
                <span aria-hidden>·</span>
                <a
                  href={STATUS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center transition-colors hover:text-foreground"
                >
                  {displayHost(STATUS_URL)}
                </a>
              </>
            )}
          </p>
        </footer>
      </div>

      {/* Panel side (hidden on mobile) */}
      <div className="hidden lg:block">
        <AuthPanel locale={locale} />
      </div>
    </div>
  );
}
