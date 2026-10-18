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
    price: "€99",
    cadence: "/ month",
    blurb: "For growing teams shipping together.",
    features: ["Unlimited servers", "Member management", "SLA · 99.9%", "Priority support"],
    cta: { label: "Choose Team", href: "/sign-up?plan=team" },
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
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={cn(
              "relative flex flex-col border bg-card p-6",
              t.highlight ? "border-foreground/70 shadow-stack" : "border-border shadow-sm"
            )}
          >
            {t.highlight && (
              // The seal straddles the card's top rule; the bg-card wrapper keeps the
              // hairline from showing through the badge's translucent tint.
              <div className="absolute -top-3 left-6 bg-card">
                <Badge variant="gilt">Most popular</Badge>
              </div>
            )}
            <h3 className="smallcaps tracking-sc text-lg font-medium">{t.name}</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="lining text-4xl font-medium">{t.price}</span>
              <span className="text-sm italic text-muted-foreground">{t.cadence}</span>
            </div>
            <p className="mt-3 text-sm italic text-muted-foreground">{t.blurb}</p>
            <ul className="lining mt-6 flex-1 space-y-2.5 border-t border-border pt-5 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant={t.highlight ? "default" : "outline"} className="mt-8 w-full">
              <Link href={t.cta.href as Route}>{t.cta.label}</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        <Link
          href={"/plans" as Route}
          className="inline-flex items-center gap-1.5 text-sm text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
        >
          Compare all features
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="smallcaps tracking-sc lining text-center text-xs text-muted-foreground">
          Cancel anytime · No credit card for free tier · 7-day money back
        </p>
      </div>
    </Section>
  );
}
