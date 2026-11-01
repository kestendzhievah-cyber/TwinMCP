import Link from "next/link";
import type { Route } from "next";
import { AuthPanel, type AuthPanelVariant } from "@/components/auth/auth-panel";
import { AuthLanguageSwitcher } from "@/components/auth/auth-language-switcher";
import { Logo } from "@/components/marketing/logo";
import type { Locale } from "@/lib/i18n/locales";
import { STATUS_URL, displayHost } from "@/lib/site-links";

const COPY = {
  en: {
    homeHref: "/",
    homeLabel: "TwinMCP, home",
    home: "Home",
    pricing: "Pricing",
    pricingHref: "/plans",
    trademark:
      "Logos are trademarks of their respective owners; their use does not imply endorsement.",
  },
  fr: {
    homeHref: "/fr",
    homeLabel: "TwinMCP, accueil",
    home: "Accueil",
    pricing: "Tarifs",
    pricingHref: "/fr/tarifs",
    trademark:
      "Les logos sont des marques de leurs propriétaires respectifs ; leur présence n’implique aucun partenariat.",
  },
} as const;

const FOOTER_LINK =
  "inline-flex min-h-10 items-center transition-colors hover:text-foreground focus-visible:text-foreground";

// The auth screens (docs/DESIGN.md, "Auth"): a split layout from lg. Left, the
// form in a white card on the light-blue page; right, a rounded surface-band
// panel (the €10 offer on sign-up, a neutral pitch elsewhere). On phones the
// panel is gone and the sign-up form shows the offer badge itself.
// Shared by the English (auth) and French (auth-fr) pages and /oauth/consent;
// each page picks its panel.
export function AuthShell({
  locale = "en",
  panel = "default",
  children,
}: {
  locale?: Locale;
  panel?: AuthPanelVariant;
  children: React.ReactNode;
}) {
  const t = COPY[locale];
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Form side */}
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10 lg:py-5">
          <Link
            href={t.homeHref as Route}
            aria-label={t.homeLabel}
            className="inline-flex min-h-10 items-center rounded-lg"
          >
            <Logo mark tagline={false} />
          </Link>
          {/* EN · FR on the sign-in / sign-up / forgot-password pairs (hidden elsewhere). */}
          <AuthLanguageSwitcher locale={locale} />
        </header>
        <main
          id="main-content"
          className="flex flex-1 items-start justify-center px-4 py-4 sm:items-center sm:px-6 sm:py-10 lg:px-10"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg sm:p-8">
            {children}
          </div>
        </main>
        {/* Address line: real facts only, items separated by a middle dot. */}
        <footer className="border-t border-border px-4 py-2 sm:px-6 lg:px-10">
          <p className="flex flex-wrap items-center justify-center gap-x-3 text-center text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} TwinMCP</span>
            <span aria-hidden>·</span>
            <Link href={t.homeHref as Route} className={FOOTER_LINK}>
              {t.home}
            </Link>
            <span aria-hidden>·</span>
            <Link href={t.pricingHref as Route} className={FOOTER_LINK}>
              {t.pricing}
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
          <p className="pb-2 text-center text-xs text-muted-foreground">{t.trademark}</p>
        </footer>
      </div>

      {/* Panel side (hidden below lg) */}
      <div className="hidden p-6 lg:flex lg:flex-col">
        <AuthPanel locale={locale} variant={panel} />
      </div>
    </div>
  );
}
