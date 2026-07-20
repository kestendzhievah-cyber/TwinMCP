import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section } from "./section";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Free",
    price: "€0",
    cadence: "forever",
    blurb: "Everything to evaluate the platform.",
    features: ["1 server", "5 official MCPs", "Community support"],
    cta: { label: "Start free", href: "/sign-up?plan=free" },
    highlight: false,
  },
  {
    name: "Pro",
    price: "€14.99",
    cadence: "/ month",
    blurb: "For developers shipping with AI every day.",
    features: ["25 servers", "Publish your own MCPs", "Audit logs · 30 days", "Priority email"],
    cta: { label: "Upgrade to Pro", href: "/sign-up?plan=pro" },
    highlight: true,
  },
  {
    name: "Team",
    price: "Custom",
    cadence: "pricing",
    blurb: "For companies — priced for your team size.",
    features: ["Unlimited servers", "Member management", "SLA · 99.9%", "Priority support"],
    cta: { label: "Contact us", href: "/enterprise" },
    highlight: false,
  },
];

export function PricingTeaser() {
  return (
    <Section
      eyebrow="Pricing"
      title="Pay for what you run, not what you might"
      description="Free tier is real — no expiry, no card. Upgrade only when you outgrow the quota."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={cn(
              "relative flex flex-col rounded-xl border bg-card p-6 transition-colors",
              t.highlight
                ? "border-foreground/40 shadow-md shadow-foreground/[0.04]"
                : "border-border/80"
            )}
          >
            {t.highlight && <Badge className="absolute -top-2.5 left-6">Most popular</Badge>}
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold tracking-tight">{t.name}</h3>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{t.price}</span>
              <span className="text-sm text-muted-foreground">{t.cadence}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant={t.highlight ? "default" : "outline"} className="mt-6 w-full">
              <Link href={t.cta.href as Route}>{t.cta.label}</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          href={"/plans" as Route}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
        >
          Compare all features
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="text-xs text-muted-foreground">
          Cancel anytime · No credit card for free tier · 7-day money back
        </p>
      </div>
    </Section>
  );
}
