"use client";

import Link from "next/link";
import type { Route } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLANS, formatPrice, type BillingCadence } from "./pricing-data";
import { track } from "@/lib/analytics/funnel";

interface PricingCardsProps {
  cadence: BillingCadence;
}

export function PricingCards({ cadence }: PricingCardsProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {PLANS.map((plan) => {
        const price = formatPrice(plan, cadence);
        const isFree = plan.id === "free";
        const isCustom = plan.monthlyUsd === null;
        const cadenceSuffix = isFree
          ? "forever"
          : isCustom
            ? "pricing"
            : cadence === "annual"
              ? "/ mo · billed annually"
              : "/ month";

        return (
          <article
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-xl border bg-card p-6 transition-colors",
              plan.highlighted
                ? "border-foreground/40 shadow-md shadow-foreground/[0.04]"
                : "border-border/80"
            )}
            aria-label={`${plan.name} plan`}
          >
            {plan.highlighted && (
              <Badge className="absolute -top-2.5 left-6">Most popular</Badge>
            )}

            <header>
              <h3 className="font-semibold tracking-tight">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
            </header>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{price}</span>
              <span className="text-sm text-muted-foreground">{cadenceSuffix}</span>
            </div>

            {!isCustom && cadence === "annual" && plan.monthlyUsd !== null && plan.monthlyUsd > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="line-through">${plan.monthlyUsd}</span> monthly
              </p>
            )}

            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {plan.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-foreground/90">{bullet}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              variant={plan.highlighted ? "default" : "outline"}
              className="mt-6 w-full"
            >
              <Link
                href={plan.cta.href as Route}
                onClick={() => {
                  if (plan.id !== "enterprise") {
                    track({
                      name: "checkout_started",
                      properties: { plan: plan.id },
                    });
                  }
                }}
              >
                {plan.cta.label}
              </Link>
            </Button>
          </article>
        );
      })}
    </div>
  );
}
