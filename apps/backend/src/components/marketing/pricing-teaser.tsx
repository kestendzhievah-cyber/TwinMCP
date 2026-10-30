import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/locales";
import { Section } from "./section";
import { freeMcpsLabel } from "@/components/pricing/pricing-data";
import { ACCOUNT_STATES, walletFacts } from "@/components/pricing/wallet-copy";
import { cn } from "@/lib/utils";

type Tier = {
  id: "credit" | "funded";
  name: string;
  price: string;
  cadence: string;
  /** Under the price: one line of terms. */
  hint?: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight: boolean;
};

const EN = walletFacts("en");
const FR = walletFacts("fr");

// Prices from lib/wallet/pricing.ts (through wallet-copy.ts), allowances from
// lib/plan-features.ts. No subscription: the two cards are the same wallet
// before and after its first paid top-up. Only enforced facts are listed.
const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    seal: string;
    compare: string;
    footnote: string;
    signUp: string;
    tiers: Tier[];
  }
> = {
  en: {
    eyebrow: "Pricing",
    title: `Pay as you go. ${EN.signupCredit} free to start.`,
    description: `No subscription. Your balance pays for tool calls (${EN.per1000Calls} per 1,000) and active CPU time (from ${EN.cpuHour.small} an hour). At zero, calls stop: there is never a surprise bill.`,
    seal: "After your first top-up",
    compare: "See the full price list",
    footnote: "No card to start · No subscription · Stops at zero, no surprise bills",
    signUp: "/sign-up",
    tiers: [
      {
        id: "credit",
        name: ACCOUNT_STATES.en.credit,
        price: EN.signupCredit,
        cadence: "on sign-up",
        hint: `Valid ${EN.signupDays} days · no card`,
        blurb: "Everything to try the platform on real work.",
        features: [
          `${EN.creditServers} server (small)`,
          freeMcpsLabel("en"),
          `About ${EN.creditCalls} tool calls’ worth, before compute`,
          "Community support",
        ],
        cta: `Get ${EN.signupCredit} of free credit`,
        highlight: false,
      },
      {
        id: "funded",
        name: ACCOUNT_STATES.en.funded,
        price: EN.minTopup,
        cadence: "minimum top-up",
        hint: "Optional auto-recharge with a monthly cap",
        blurb: "Everything we offer, billed only for what you use.",
        features: [
          `${EN.fundedServers} servers`,
          "All box sizes (small, medium, large)",
          `Tool calls ${EN.per1000Calls} per 1,000`,
          "Publish your own MCPs",
          "20 API keys",
          "Audit logs · 90 days",
          "Usage export",
          "Priority email support",
        ],
        cta: "Start, then top up",
        highlight: true,
      },
    ],
  },
  fr: {
    eyebrow: "Tarifs",
    title: `Payez à l’usage. ${FR.signupCredit} offerts pour commencer.`,
    description: `Sans abonnement. Votre solde paie les appels d’outils (${FR.per1000Calls} les 1 000) et le temps CPU actif (dès ${FR.cpuHour.small} l’heure). À zéro, les appels s’arrêtent : jamais de facture surprise.`,
    seal: "Après la première recharge",
    compare: "Voir la grille tarifaire complète",
    footnote: "Sans carte pour commencer · Sans abonnement · Arrêt à zéro, aucune facture surprise",
    signUp: "/fr/inscription",
    tiers: [
      {
        id: "credit",
        name: ACCOUNT_STATES.fr.credit,
        price: FR.signupCredit,
        cadence: "à l’inscription",
        hint: `Valable ${FR.signupDays} jours · sans carte`,
        blurb: "Tout pour essayer la plateforme sur un vrai projet.",
        features: [
          `${FR.creditServers} serveur (small)`,
          freeMcpsLabel("fr"),
          `L’équivalent d’environ ${FR.creditCalls} appels d’outils, hors calcul`,
          "Support communautaire",
        ],
        cta: `Recevoir ${FR.signupCredit} de crédit offert`,
        highlight: false,
      },
      {
        id: "funded",
        name: ACCOUNT_STATES.fr.funded,
        price: FR.minTopup,
        cadence: "recharge minimale",
        hint: "Recharge automatique en option, plafonnée chaque mois",
        blurb: "Tout ce que nous proposons, facturé selon votre usage.",
        features: [
          `${FR.fundedServers} serveurs`,
          "Toutes les tailles de box (small, medium, large)",
          `Appels d’outils ${FR.per1000Calls} les 1 000`,
          "Publiez vos propres MCP",
          "20 clés API",
          "Journaux d’audit · 90 jours",
          "Export de l’usage",
          "Support prioritaire par e-mail",
        ],
        cta: "Commencer, puis recharger",
        highlight: true,
      },
    ],
  },
};

export function PricingTeaser({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <Section eyebrow={t.eyebrow} title={t.title} description={t.description}>
      {/* Two states of one wallet: a centred two-column spread held to ~860px. */}
      <div className="mx-auto grid max-w-[860px] gap-6 md:grid-cols-2">
        {t.tiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "relative flex flex-col border bg-card p-6",
              tier.highlight ? "border-foreground/70 shadow-stack" : "border-border shadow-sm"
            )}
          >
            {tier.highlight && (
              // The seal straddles the card's top rule; the bg-card wrapper keeps the
              // hairline from showing through the badge's translucent tint.
              <div className="absolute -top-3 left-6 bg-card">
                <Badge variant="gilt">{t.seal}</Badge>
              </div>
            )}
            <h3 className="smallcaps tracking-sc text-lg font-medium">{tier.name}</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="lining text-4xl font-medium">{tier.price}</span>
              <span className="text-sm italic text-muted-foreground">{tier.cadence}</span>
            </div>
            {tier.hint && <p className="lining mt-1 text-xs text-muted-foreground">{tier.hint}</p>}
            <p className="mt-3 text-sm italic text-muted-foreground">{tier.blurb}</p>
            <ul className="lining mt-6 flex-1 space-y-2.5 border-t border-border pt-5 text-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={tier.highlight ? "default" : "outline"}
              className="mt-8 w-full"
            >
              <Link href={t.signUp as Route} data-cta-location={`pricing_${tier.id}`}>
                {tier.cta}
              </Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        <Link
          href={(locale === "fr" ? "/fr/tarifs" : "/plans") as Route}
          className="inline-flex items-center gap-1.5 text-sm text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
        >
          {t.compare}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="smallcaps tracking-sc lining text-center text-xs text-muted-foreground">
          {t.footnote}
        </p>
      </div>
    </Section>
  );
}
