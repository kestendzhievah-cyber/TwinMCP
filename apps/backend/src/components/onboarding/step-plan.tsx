"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Choose your plan</h1>
        <p className="text-sm text-muted-foreground">
          Start free, or unlock more servers and bigger runtimes. You can change this anytime.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((p) => {
          const recommended = p.highlighted;
          const isPending = pending === p.id;
          const preSelected = initialPlan === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-xl border p-5 transition-colors",
                recommended || preSelected ? "border-foreground shadow-sm" : "border-border",
              )}
            >
              {recommended && (
                <span className="mb-2 w-fit rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                  Recommended
                </span>
              )}
              <h2 className="text-base font-semibold">{p.name}</h2>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold">{formatPrice(p, "monthly")}</span>
                {p.monthlyUsd !== 0 && <span className="text-xs text-muted-foreground">/mo</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>

              <ul className="mt-4 space-y-2 text-sm">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5"
                variant={recommended ? "default" : "outline"}
                disabled={pending !== null}
                onClick={() => choose(p.id as SelectablePlan)}
              >
                {isPending ? "…" : p.id === "free" ? "Start free" : `Choose ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Paid plans open a secure Stripe checkout. Cancel anytime.
      </p>
    </div>
  );
}
