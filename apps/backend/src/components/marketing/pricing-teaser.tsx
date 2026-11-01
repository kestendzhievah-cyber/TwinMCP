import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/locales";
import { CostEstimator } from "@/components/pricing/cost-estimator";
import {
  FUNDED_UNLOCKS,
  PRICE_TABLE,
  count,
  eurAmount,
  walletFacts,
} from "@/components/pricing/wallet-copy";
import { OfferTerms, offerCopy } from "./offer-badge";
import { Section } from "./section";

// The price list and a compact estimator, side by side. Prices come from
// lib/wallet/pricing.ts through wallet-copy.ts; the estimator reuses
// estimateMonthly(), so this block holds no pricing formula of its own.
// No subscription: one prepaid balance, before and after its first top-up.
const EN = walletFacts("en");
const FR = walletFacts("fr");

function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const COPY = {
  en: {
    eyebrow: "Pricing",
    title: "Pay only for what you use",
    listLabel: "Price list",
    rows: [
      { label: "Tool calls", value: `${EN.per1000Calls} per ${count(1000, "en")}` },
      {
        label: "Compute",
        value: `${EN.cpuHour.small} per active CPU-hour (small server)`,
      },
    ],
    larger: `${sentence(EN.largerSizes)}.`,
    topups: `Top up from ${EN.minTopup} (${EN.presets.join(" · ")}), up to ${EN.maxTopup}. No subscription.`,
    unlocks: FUNDED_UNLOCKS.en,
    footnote: `At ${eurAmount(0, "en")}, tool calls stop and servers pause; metered compute may run up to ${EN.overdraft} below zero first. Nothing is charged to a card unless you turn on auto-recharge.`,
    funded: "Start, then top up",
    full: "See full pricing",
    pricing: "/plans",
  },
  fr: {
    eyebrow: "Tarifs",
    title: "Payez uniquement ce que vous utilisez",
    listLabel: "Grille tarifaire",
    rows: [
      { label: "Appels d’outils", value: `${FR.per1000Calls} les ${count(1000, "fr")}` },
      {
        label: "Calcul",
        value: `${FR.cpuHour.small} par heure de CPU actif (petit serveur)`,
      },
    ],
    larger: `${sentence(FR.largerSizes)}.`,
    topups: `Recharge dès ${FR.minTopup} (${PRICE_TABLE.topupPresetsEur.map((v) => count(v, "fr")).join(" · ")} €), jusqu’à ${FR.maxTopup}. Sans abonnement.`,
    unlocks: FUNDED_UNLOCKS.fr,
    footnote: `À ${eurAmount(0, "fr")}, les appels s’arrêtent et les serveurs se mettent en pause ; le calcul mesuré peut descendre jusqu’à ${FR.overdraft} sous zéro avant. Rien n’est prélevé sur une carte sauf si vous activez la recharge automatique.`,
    funded: "Commencer, puis recharger",
    full: "Voir les tarifs",
    pricing: "/fr/tarifs",
  },
} as const;

export function PricingTeaser({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const o = offerCopy(locale);
  return (
    <Section
      id="pricing"
      eyebrow={t.eyebrow}
      title={t.title}
      className="scroll-mt-20 bg-background py-16 md:py-24"
      containerClassName="px-4 sm:px-6"
    >
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {/* The price list. */}
        <Card className="flex flex-col p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">{t.listLabel}</h3>
          <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
            {t.rows.map((r) => (
              <div
                key={r.label}
                className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="font-semibold tabular-nums text-foreground sm:text-right">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t.larger}</p>
          <p className="mt-4 text-sm tabular-nums text-foreground">{t.topups}</p>
          <p className="mt-2 text-sm text-foreground">{t.unlocks}</p>
          <p className="mt-4 flex-1 text-xs text-muted-foreground">{t.footnote}</p>
          <div className="mt-6">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={o.signUpHref as Route} data-cta-location="pricing_funded">
                {t.funded}
              </Link>
            </Button>
          </div>
        </Card>

        {/* The estimator, then the one primary action of the block. */}
        <Card data-sticky-cta-hide className="flex flex-col gap-6 p-5 sm:p-6">
          <CostEstimator table={PRICE_TABLE} locale={locale} variant="compact" />
          <div className="mt-auto">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={o.signUpHref as Route} data-cta-location="pricing_credit">
                {o.cta}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            {/* The offer is never stated without its terms (docs/DESIGN.md). */}
            <OfferTerms locale={locale} className="mt-3 justify-start gap-x-3 text-xs sm:text-sm" />
          </div>
        </Card>
      </div>

      <div className="mt-8 flex justify-center">
        <Button asChild variant="link">
          <Link href={t.pricing as Route}>
            {t.full}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
