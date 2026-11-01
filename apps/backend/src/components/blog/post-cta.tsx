import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfferBadge } from "@/components/marketing/offer-badge";
import { SIGNUP_OFFER, walletFacts } from "@/components/pricing/wallet-copy";
import type { Locale } from "@/lib/i18n/locales";

// End-of-article call to action shared by the EN and FR post layouts. Every
// figure comes from the wallet facts, so the offer never drifts from what the
// ledger grants. One rose button (the claim), one outline (pricing).
const COPY = {
  en: {
    title: "Ready to run an MCP server in 2 minutes?",
    terms: (days: number) => `${SIGNUP_OFFER.en}, valid ${days} days. No subscription.`,
    primary: (credit: string) => `Claim my ${credit} credit`,
    primaryHref: "/sign-up?plan=free",
    secondary: "See pricing",
    secondaryHref: "/plans",
  },
  fr: {
    title: "Prêt à lancer un serveur MCP en 2 minutes ?",
    terms: (days: number) => `${SIGNUP_OFFER.fr}, valable ${days} jours. Sans abonnement.`,
    primary: (credit: string) => `Récupérer mes ${credit} offerts`,
    primaryHref: "/fr/inscription?plan=free",
    secondary: "Voir les tarifs",
    secondaryHref: "/fr/tarifs",
  },
} as const;

export function PostCta({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const facts = walletFacts(locale);
  return (
    <div className="rounded-3xl bg-surface-band p-6 text-center sm:p-10">
      <OfferBadge locale={locale} />
      <h2 className="mt-4 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {t.title}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t.terms(facts.signupDays)}</p>
      <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg">
          <Link href={t.primaryHref as Route}>
            {t.primary(facts.signupCredit)}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={t.secondaryHref as Route}>{t.secondary}</Link>
        </Button>
      </div>
    </div>
  );
}
