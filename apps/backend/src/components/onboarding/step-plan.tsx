"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ANNUAL_DISCOUNT_PCT,
  PLANS,
  formatPrice,
  type BillingCadence,
} from "@/components/pricing/pricing-data";
import { PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { track } from "@/lib/analytics/funnel";

// Only Free and Pro are sold; Team is grandfathered and never offered here.
export type SelectablePlan = "free" | "pro";
/** What the checkout API accepts (pricing-data's "annual" is the UI word). */
export type CheckoutCadence = "monthly" | "yearly";

export const toCheckoutCadence = (c: BillingCadence): CheckoutCadence =>
  c === "annual" ? "yearly" : "monthly";

interface StepPlanProps {
  /** Plan pre-selected on the pricing/sign-up page, if any. */
  initialPlan?: string | null;
  /**
   * Called when the user picks a plan. For "free" the wizard advances; for
   * "pro" it kicks off Stripe checkout at the chosen cadence. May be async
   * (checkout redirect).
   */
  onSelectPlan: (plan: SelectablePlan, cadence: CheckoutCadence) => Promise<void> | void;
}

export function StepPlan({ initialPlan, onSelectPlan }: StepPlanProps) {
  const [pending, setPending] = useState<SelectablePlan | null>(null);
  const [cadence, setCadence] = useState<BillingCadence>("monthly");
  const tiers = PLANS.filter((p) => p.id === "free" || p.id === "pro");
  const pro = PLANS.find((p) => p.id === "pro");
  // An old sign-up link may still carry plan=team: treat it as Pro.
  const preSelectedPlan = initialPlan === "team" ? "pro" : initialPlan;
  // €135 a year, shown as the yearly total next to the per-month figure.
  const yearlyTotal = pro ? Math.round(pro.annualMonthlyUsd * 12) : 0;

  function toggleCadence(next: BillingCadence) {
    if (next === cadence) return;
    setCadence(next);
    track({
      name: "cadence_toggled",
      properties: { cadence: toCheckoutCadence(next), surface: "onboarding" },
    });
  }

  async function choose(plan: SelectablePlan) {
    if (pending) return;
    setPending(plan);
    try {
      await onSelectPlan(plan, toCheckoutCadence(cadence));
    } finally {
      // "free" advances (this unmounts); "pro" redirects to Stripe. If a
      // redirect fails the wizard handles it and we re-enable the buttons.
      setPending(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium md:text-3xl">Choose your plan</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Start free, or unlock more servers and bigger runtimes. You can change this anytime.
        </p>
      </div>

      {/* Cadence: a segmented control cut from the card (two small-caps
          segments inside one ink hairline), the yearly saving beside it. */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Billing cadence"
          className="inline-flex divide-x divide-foreground/60 border border-foreground/60 bg-card"
        >
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              role="tab"
              type="button"
              aria-selected={cadence === c}
              onClick={() => toggleCadence(c)}
              className={cn(
                "smallcaps tracking-sc h-10 px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                cadence === c
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        {pro && (
          <p className="lining text-sm italic text-muted-foreground">
            Yearly: €{yearlyTotal} a year ({formatPrice(pro, "annual")}/mo) — save{" "}
            {ANNUAL_DISCOUNT_PCT}% over monthly.
          </p>
        )}
      </div>

      {/* Pricing tiers (DESIGN.md §5): hairline cards, small-capital names,
          lining prices; the recommended tier is the highlight — ink hairline,
          the stack of cards under it and the one gilt seal of the view. */}
      <div className="grid gap-5 md:grid-cols-2">
        {tiers.map((p) => {
          const recommended = p.highlighted;
          const isPending = pending === p.id;
          const preSelected = preSelectedPlan === p.id;
          const paid = p.monthlyUsd !== 0;
          return (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col border bg-card p-6 transition-colors",
                recommended
                  ? "border-foreground/70 shadow-stack"
                  : preSelected
                    ? "border-foreground/70"
                    : "border-border"
              )}
            >
              {recommended && (
                // The seal straddles the card's top rule; the bg-card wrapper keeps the
                // hairline from showing through the badge's translucent tint.
                <div className="absolute -top-3 left-6 bg-card">
                  <Badge variant="gilt">Recommended</Badge>
                </div>
              )}
              <h2 className="smallcaps tracking-sc text-lg font-medium">{p.name}</h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="lining text-4xl font-medium">{formatPrice(p, cadence)}</span>
                {paid && (
                  <span className="text-sm italic text-muted-foreground">
                    {cadence === "annual" ? "/ mo · billed yearly" : "/mo"}
                  </span>
                )}
              </div>
              {paid && cadence === "annual" && (
                <p className="lining mt-1 text-xs italic text-muted-foreground">
                  €{yearlyTotal} billed once a year
                </p>
              )}
              <p className="mt-2 text-sm italic text-muted-foreground">{p.blurb}</p>

              <ul className="lining mt-5 flex-1 space-y-2 text-sm">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6"
                variant={recommended ? "default" : "outline"}
                disabled={pending !== null}
                onClick={() => choose(p.id as SelectablePlan)}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {p.id === "free" ? "Starting…" : "Redirecting…"}
                  </>
                ) : p.id === "free" ? (
                  "Start free"
                ) : (
                  `Try ${p.name} free for ${PRO_TRIAL_DAYS} days`
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="lining text-center text-xs italic text-muted-foreground">
        A first Pro subscription starts with {PRO_TRIAL_DAYS} days free: card required at checkout,
        nothing charged for {PRO_TRIAL_DAYS} days, cancel anytime. Then{" "}
        {cadence === "annual"
          ? `€${yearlyTotal} a year`
          : `${pro ? formatPrice(pro, "monthly") : "€14.99"} a month`}
        .
      </p>
    </div>
  );
}
