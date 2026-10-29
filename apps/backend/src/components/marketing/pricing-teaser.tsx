import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/locales";
import { Section } from "./section";
import { PLANS, annualMonthlyHint, freeMcpsLabel } from "@/components/pricing/pricing-data";
import { cn } from "@/lib/utils";

type Tier = {
  id: "free" | "pro";
  name: string;
  price: string;
  cadence: string;
  /** Under the price: the yearly option, from pricing-data (never hand-typed). */
  annualHint?: string | null;
  blurb: string;
  features: string[];
  cta: string;
  highlight: boolean;
};

const PRO_TIER = PLANS.find((plan) => plan.id === "pro");

// Prices and quotas mirror components/pricing/pricing-data.ts and
// lib/plan-features.ts. Only features the product enforces are listed here.
// Two plans are sold (Free and Pro); Team is grandfathered, never shown.
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
    title: "A flat price, no usage meters",
    description:
      "The Free plan is real: no expiry, no card. Pro is €14.99 a month, however much you use it. Only tool calls count toward the daily cap, and at the cap calls pause until the next window: there is never a per-call bill.",
    seal: "Recommended",
    compare: "Compare all features",
    footnote:
      "1 month of Pro free on a first subscription · Cancel anytime · Save up to 25% with annual billing",
    signUp: "/sign-up",
    tiers: [
      {
        id: "free",
        name: "Free",
        price: "€0",
        cadence: "forever",
        blurb: "Everything to evaluate the platform.",
        features: ["1 server", freeMcpsLabel("en"), "50 tool calls / day", "Community support"],
        cta: "Start free",
        highlight: false,
      },
      {
        id: "pro",
        name: "Pro",
        price: "€14.99",
        cadence: "/ month",
        annualHint: PRO_TIER ? annualMonthlyHint(PRO_TIER, "en") : null,
        blurb: "Everything we offer, for developers shipping with AI every day.",
        features: [
          "50 servers",
          "All box sizes (small, medium, large)",
          "5,000 tool calls / day",
          "Publish your own MCPs",
          "20 API keys",
          "Audit logs · 90 days",
          "Usage export",
          "Priority email support",
        ],
        cta: "Upgrade to Pro",
        highlight: true,
      },
    ],
  },
  fr: {
    eyebrow: "Tarifs",
    title: "Gratuit pour commencer, Pro à 14,99 € par mois",
    description:
      "L’offre Free n’expire pas et ne demande aucune carte bancaire. Pro coûte 14,99 € par mois, quel que soit votre usage. Seuls les appels d’outils comptent dans le plafond journalier ; une fois atteint, les appels reprennent à la fenêtre suivante, sans jamais de facturation à l’appel.",
    seal: "Recommandé",
    compare: "Comparer toutes les fonctionnalités",
    footnote:
      "1 mois de Pro offert sur un premier abonnement · Résiliable à tout moment · Jusqu’à 25 % d’économie en annuel",
    signUp: "/fr/inscription",
    tiers: [
      {
        id: "free",
        name: "Free",
        price: "0 €",
        cadence: "pour toujours",
        blurb: "Tout pour évaluer la plateforme.",
        features: [
          "1 serveur",
          freeMcpsLabel("fr"),
          "50 appels d’outils par jour",
          "Support communautaire",
        ],
        cta: "Démarrer gratuitement",
        highlight: false,
      },
      {
        id: "pro",
        name: "Pro",
        price: "14,99 €",
        cadence: "/ mois",
        annualHint: PRO_TIER ? annualMonthlyHint(PRO_TIER, "fr") : null,
        blurb:
          "Tout ce que nous proposons, pour les développeurs qui codent avec l’IA au quotidien.",
        features: [
          "50 serveurs",
          "Toutes les tailles de box (small, medium, large)",
          "5 000 appels d’outils par jour",
          "Publiez vos propres MCP",
          "20 clés API",
          "Journaux d’audit · 90 jours",
          "Export de l’usage",
          "Support prioritaire par e-mail",
        ],
        cta: "Passer à Pro",
        highlight: true,
      },
    ],
  },
};

export function PricingTeaser({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <Section eyebrow={t.eyebrow} title={t.title} description={t.description}>
      {/* Two tiers: a centred two-column spread held to ~860px, Pro highlighted. */}
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
            {tier.annualHint && (
              <p className="lining mt-1 text-xs text-muted-foreground">{tier.annualHint}</p>
            )}
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
              <Link
                href={`${t.signUp}?plan=${tier.id}` as Route}
                data-cta-location={`pricing_${tier.id}`}
              >
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
