"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PLANS,
  annualBillingNote,
  formatPrice,
  planCopy,
  type BillingCadence,
} from "./pricing-data";
import { track } from "@/lib/analytics/funnel";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n/locales";

// Card chrome strings (the plan copy itself comes from planCopy()).
const CHROME = {
  en: {
    recommended: "Recommended",
    forever: "forever",
    perMonthAnnual: "/ mo · billed annually",
    perMonth: "/ month",
    monthly: "monthly",
    redirecting: "Redirecting…",
    checkoutError: "Couldn't start checkout. Please try again.",
    networkError: "Network error — couldn't start checkout. Please try again.",
    planAria: (name: string) => `${name} plan`,
    trial: "1 month free on a first subscription · card required · cancel anytime during the trial",
  },
  fr: {
    recommended: "Recommandé",
    forever: "pour toujours",
    perMonthAnnual: "/ mois · facturé annuellement",
    perMonth: "/ mois",
    monthly: "par mois",
    redirecting: "Redirection…",
    checkoutError: "Impossible de démarrer le paiement. Réessayez.",
    networkError: "Erreur réseau — impossible de démarrer le paiement. Réessayez.",
    planAria: (name: string) => `Forfait ${name}`,
    trial: "1 mois offert sur un premier abonnement · carte demandée · résiliable pendant l’essai",
  },
} as const;

export interface PromoOffer {
  /** Stripe promotion_code id (promo_xxx) — pre-applied in checkout. */
  promotionCodeId: string;
  /** Creator slug for attribution. */
  creatorSlug: string;
  /** Which plan the promo applies to — only Pro is sold, so only Pro. */
  appliesTo: "pro";
  /** Cadence the promo is scoped to (Stripe coupons are price-scoped). */
  cadence: BillingCadence;
  /** Marketing copy shown on the discounted card. */
  badge: string;
}

interface PricingCardsProps {
  cadence: BillingCadence;
  promo?: PromoOffer;
  locale?: Locale;
}

// Map UI cadence ("monthly"/"annual") to API cadence ("monthly"/"yearly").
const apiCadence = (c: BillingCadence) => (c === "annual" ? "yearly" : "monthly");

export function PricingCards({ cadence, promo, locale = "en" }: PricingCardsProps) {
  const router = useRouter();
  const c = CHROME[locale];
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  // Detect session client-side so the CTAs can short-circuit to checkout
  // for already-authenticated visitors. Middleware would otherwise redirect
  // them to /dashboard mid-flow, which costs a round-trip and ditches the
  // selected plan. This only warms the answer: the Pro CTA never waits for it
  // (handleUpgrade resolves the session itself when it is still unknown).
  useEffect(() => {
    let alive = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (alive) setSignedIn(!!data.user);
      })
      .catch(() => {
        if (alive) setSignedIn(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function resolveSignedIn(): Promise<boolean> {
    if (signedIn !== null) return signedIn;
    try {
      const { data } = await createClient().auth.getUser();
      const known = !!data.user;
      setSignedIn(known);
      return known;
    } catch {
      // No session readable: sign-up is the safe path (it resumes checkout).
      return false;
    }
  }

  // A promo only applies to its configured plan + cadence pair (Stripe coupons
  // are price-scoped). Switching the toggle to annual hides a monthly promo.
  function promoFor(planId: "pro"): PromoOffer | undefined {
    if (!promo) return undefined;
    if (promo.appliesTo !== planId) return undefined;
    if (promo.cadence !== cadence) return undefined;
    return promo;
  }

  async function handleUpgrade(planId: "pro") {
    setPending(planId);
    const activePromo = promoFor(planId);
    track({
      name: "checkout_started",
      properties: {
        plan: planId,
        cadence,
        ...(activePromo ? { creatorSlug: activePromo.creatorSlug } : {}),
      },
    });

    if (await resolveSignedIn()) {
      try {
        const res = await fetch("/api/v2/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            plan: planId,
            cadence: apiCadence(cadence),
            from: "pricing",
            ...(activePromo
              ? {
                  promotionCodeId: activePromo.promotionCodeId,
                  creatorSlug: activePromo.creatorSlug,
                }
              : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        toast.error(data.message ?? c.checkoutError);
      } catch {
        toast.error(c.networkError);
      }
      setPending(null);
      return;
    }

    // Not signed in — bounce through sign-up, but carry plan + cadence (and
    // the promo slug if any) so the sign-up form can resume checkout right
    // after email confirm. French surfaces use the French sign-up form, which
    // takes the same params.
    const params = new URLSearchParams({ plan: planId, cadence: apiCadence(cadence) });
    if (activePromo) params.set("promo", activePromo.creatorSlug);
    const signUpPath = locale === "fr" ? "/fr/inscription" : "/sign-up";
    router.push(`${signUpPath}?${params.toString()}` as Route);
  }

  return (
    // Two plans: a centred two-column grid held to ~860px so the pair reads
    // as one balanced spread, with Pro as the single highlighted tier.
    <div className="mx-auto grid max-w-[860px] gap-6 md:grid-cols-2">
      {PLANS.map((plan) => {
        const price = formatPrice(plan, cadence, locale);
        const copy = planCopy(plan, locale);
        const isFree = plan.id === "free";
        // Pro is self-serve checkout; Free is a plain link to sign-up. Team is
        // no longer sold (existing subscribers are grandfathered elsewhere).
        const isBillable = plan.id === "pro";
        const activePromo = isBillable ? promoFor("pro") : undefined;
        const cadenceSuffix = isFree
          ? c.forever
          : cadence === "annual"
            ? c.perMonthAnnual
            : c.perMonth;
        // French surfaces send the free CTA to the French sign-up form too.
        const freeHref = locale === "fr" ? "/fr/inscription?plan=free" : plan.cta.href;

        return (
          <article
            key={plan.id}
            className={cn(
              "relative flex flex-col border bg-card p-6 transition-colors",
              activePromo
                ? "border-success/40 shadow-md"
                : plan.highlighted
                  ? "border-foreground/70 shadow-stack"
                  : "border-border shadow-sm"
            )}
            aria-label={c.planAria(plan.name)}
          >
            {activePromo ? (
              <Badge className="absolute -top-3 left-6 bg-gilt text-gilt-foreground hover:bg-gilt/90">
                {activePromo.badge}
              </Badge>
            ) : plan.highlighted ? (
              // The seal straddles the card's top rule; the bg-card wrapper keeps the
              // hairline from showing through the badge's translucent tint.
              <div className="absolute -top-3 left-6 bg-card">
                <Badge variant="gilt">{c.recommended}</Badge>
              </div>
            ) : null}

            <header>
              <h3 className="smallcaps tracking-sc text-lg font-medium">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{copy.blurb}</p>
            </header>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="lining text-4xl font-medium">{price}</span>
              <span className="text-sm italic text-muted-foreground">{cadenceSuffix}</span>
            </div>

            {cadence === "annual" && plan.monthlyUsd > 0 && (
              <>
                {/* What the card is actually charged, once a year. A pre-applied
                    promo replaces the free month, so it drops that clause. */}
                <p className="lining mt-1 text-sm font-medium text-foreground/90">
                  {annualBillingNote(plan, locale, { trial: isBillable && !activePromo })}
                </p>
                <p className="lining mt-1 text-xs text-muted-foreground">
                  <span className="line-through">{formatPrice(plan, "monthly", locale)}</span>{" "}
                  {c.monthly}
                </p>
              </>
            )}

            {isBillable && !activePromo && (
              <p className="lining mt-2 text-xs font-medium text-gilt">{c.trial}</p>
            )}

            <ul className="lining mt-5 flex-1 space-y-2 text-sm">
              {copy.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-foreground/90">{bullet}</span>
                </li>
              ))}
            </ul>

            {isBillable ? (
              <Button
                variant={plan.highlighted ? "default" : "outline"}
                className="mt-6 w-full"
                onClick={() => handleUpgrade("pro")}
                disabled={pending !== null}
              >
                {pending === plan.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {c.redirecting}
                  </>
                ) : (
                  copy.ctaLabel
                )}
              </Button>
            ) : (
              <Button
                asChild
                variant={plan.highlighted ? "default" : "outline"}
                className="mt-6 w-full"
              >
                <Link
                  href={freeHref as Route}
                  onClick={() => {
                    // Only the free CTA fires the funnel event here; the
                    // billable plan runs through handleUpgrade().
                    if (plan.id === "free") {
                      track({
                        name: "checkout_started",
                        properties: { plan: plan.id, cadence },
                      });
                    }
                  }}
                >
                  {copy.ctaLabel}
                </Link>
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}
