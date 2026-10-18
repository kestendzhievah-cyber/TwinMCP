"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS, formatPrice } from "@/components/pricing/pricing-data";

export type SelectablePlan = "free" | "pro" | "team";

interface StepPlanProps {
  /** Plan pre-selected on the pricing/sign-up page, if any. */
  initialPlan?: string | null;
  /**
   * Called when the user picks a plan. For "free" the wizard advances; for
   * "pro"/"team" it kicks off Stripe checkout. May be async (checkout redirect).
   */
  onSelectPlan: (plan: SelectablePlan) => Promise<void> | void;
}

export function StepPlan({ initialPlan, onSelectPlan }: StepPlanProps) {
  const [pending, setPending] = useState<SelectablePlan | null>(null);
  const tiers = PLANS.filter((p) => p.id !== "enterprise");

  async function choose(plan: SelectablePlan) {
    if (pending) return;
    setPending(plan);
    try {
      await onSelectPlan(plan);
    } finally {
      // "free" advances (this unmounts); "pro"/"team" redirect to Stripe. If a
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

      {/* Pricing tiers (DESIGN.md §5): hairline cards, small-capital names,
          lining prices; the recommended tier is the highlight — ink hairline,
          the stack of cards under it and the one gilt seal of the view. */}
      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((p) => {
          const recommended = p.highlighted;
          const isPending = pending === p.id;
          const preSelected = initialPlan === p.id;
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
                <span className="lining text-4xl font-medium">{formatPrice(p, "monthly")}</span>
                {p.monthlyUsd !== 0 && (
                  <span className="text-sm italic text-muted-foreground">/mo</span>
                )}
              </div>
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
                  `Choose ${p.name}`
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs italic text-muted-foreground">
        Paid plans open a secure Stripe checkout. Cancel anytime.
      </p>
    </div>
  );
}
