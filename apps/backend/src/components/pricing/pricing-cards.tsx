"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLANS, formatPrice, planCopy, type BillingCadence } from "./pricing-data";
import { track } from "@/lib/analytics/funnel";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n/locales";

// Card chrome strings (the plan copy itself comes from planCopy()).
const CHROME = {
  en: {
    mostPopular: "Most popular",
    forever: "forever",
    pricing: "pricing",
    perMonthAnnual: "/ mo · billed annually",
    perMonth: "/ month",
    monthly: "monthly",
    redirecting: "Redirecting…",
    checkoutError: "Couldn't start checkout. Please try again.",
    networkError: "Network error — couldn't start checkout. Please try again.",
    planAria: (name: string) => `${name} plan`,
  },
  fr: {
    mostPopular: "Le plus populaire",
    forever: "à vie",
    pricing: "sur devis",
    perMonthAnnual: "/ mois · facturé annuellement",
    perMonth: "/ mois",
    monthly: "par mois",
    redirecting: "Redirection…",
    checkoutError: "Impossible de démarrer le paiement. Réessayez.",
    networkError: "Erreur réseau — impossible de démarrer le paiement. Réessayez.",
    planAria: (name: string) => `Forfait ${name}`,
  },
} as const;

export interface PromoOffer {
  /** Stripe promotion_code id (promo_xxx) — pre-applied in checkout. */
  promotionCodeId: string;
  /** Creator slug for attribution. */
  creatorSlug: string;
  /** Which plan the promo applies to — others render unchanged. */
  appliesTo: "pro" | "team";
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
  // selected plan.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  // A promo only applies to its configured plan + cadence pair (Stripe coupons
  // are price-scoped). Switching the toggle to annual hides a monthly promo.
  function promoFor(planId: "pro" | "team"): PromoOffer | undefined {
    if (!promo) return undefined;
    if (promo.appliesTo !== planId) return undefined;
    if (promo.cadence !== cadence) return undefined;
    return promo;
  }

  async function handleUpgrade(planId: "pro" | "team") {
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

    if (signedIn) {
      try {
        const res = await fetch("/api/v2/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            plan: planId,
            cadence: apiCadence(cadence),
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
    // after email confirm.
    const params = new URLSearchParams({ plan: planId, cadence: apiCadence(cadence) });
    if (activePromo) params.set("promo", activePromo.creatorSlug);
    router.push(`/sign-up?${params.toString()}` as Route);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {PLANS.map((plan) => {
        const price = formatPrice(plan, cadence, locale);
        const copy = planCopy(plan, locale);
        const isFree = plan.id === "free";
        const isCustom = plan.monthlyUsd === null;
        // Pro and Team are self-serve checkout; free + enterprise are plain links
        // (enterprise is contact-based, free just routes to sign-up).
        const isBillable = plan.id === "pro" || plan.id === "team";
        const activePromo = isBillable ? promoFor(plan.id as "pro" | "team") : undefined;
        const cadenceSuffix = isFree
          ? c.forever
          : isCustom
            ? c.pricing
            : cadence === "annual"
              ? c.perMonthAnnual
              : c.perMonth;

        return (
          <article
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-xl border bg-card p-6 transition-colors",
              activePromo
                ? "border-emerald-500/60 shadow-md shadow-emerald-500/[0.08]"
                : plan.highlighted
                  ? "border-foreground/40 shadow-md shadow-foreground/[0.04]"
                  : "border-border/80"
            )}
            aria-label={c.planAria(plan.name)}
          >
            {activePromo ? (
              <Badge className="absolute -top-2.5 left-6 bg-emerald-500 text-white hover:bg-emerald-500">
                {activePromo.badge}
              </Badge>
            ) : plan.highlighted ? (
              <Badge className="absolute -top-2.5 left-6">{c.mostPopular}</Badge>
            ) : null}

            <header>
              <h3 className="font-semibold tracking-tight">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{copy.blurb}</p>
            </header>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{price}</span>
              <span className="text-sm text-muted-foreground">{cadenceSuffix}</span>
            </div>

            {!isCustom &&
              cadence === "annual" &&
              plan.monthlyUsd !== null &&
              plan.monthlyUsd > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="line-through">€{plan.monthlyUsd}</span> {c.monthly}
                </p>
              )}

            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {copy.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-foreground/90">{bullet}</span>
                </li>
              ))}
            </ul>

            {isBillable ? (
              <Button
                variant={plan.highlighted ? "default" : "outline"}
                className="mt-6 w-full"
                onClick={() => handleUpgrade(plan.id as "pro" | "team")}
                disabled={pending !== null || signedIn === null}
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
                  href={plan.cta.href as Route}
                  onClick={() => {
                    // Only the free CTA fires the funnel event here; the
                    // billable plans run through handleUpgrade(), and
                    // enterprise is a mailto (no checkout to track).
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
