import Link from "next/link";
import type { Metadata, Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { PricingExperience } from "@/components/pricing/pricing-experience";
import { TrustSignals } from "@/components/pricing/trust-signals";
import { ComparisonTable } from "@/components/pricing/comparison-table";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free forever (1 server, 5 official MCPs). Pro $20/mo, Team $50/mo, Enterprise on request. No credit card on the free tier.",
  alternates: { canonical: "/plans" },
  openGraph: {
    title: "TwinMCP Pricing — start free, upgrade only when you outgrow it",
    description:
      "Compare Free, Pro, Team, and Enterprise tiers — runtime, MCPs, audit logs, support SLA.",
    url: "/plans",
  },
};

const pricingFaq: FaqItem[] = [
  {
    q: "How does annual billing work?",
    a: "You pay 12 months up front and save 20% versus monthly. Cancel mid-cycle within the first 7 days for a full refund — after that the plan keeps running until the end of the year, no refunds prorated.",
  },
  {
    q: "Can I switch plans later?",
    a: "Anytime, in two clicks from /dashboard/billing. Upgrades apply immediately with a prorated charge. Downgrades apply at the next renewal so you keep what you paid for until then.",
  },
  {
    q: "What happens if I exceed my quota?",
    a: "Quotas are soft caps: existing servers keep running, but new ones (and new MCP installs above the limit) are blocked until you upgrade. We never auto-charge you for overages.",
  },
  {
    q: "Do you offer discounts?",
    a: "50% off for verified non-profits, students, and active maintainers of public OSS MCPs. Email hello@twinmcp.dev with proof. Volume discounts on Team are negotiated per-account — talk to sales.",
  },
  {
    q: "What happens to my data when I cancel?",
    a: "Servers move to read-only at the end of your billing period. You have 30 days to export logs, configs, and key metadata via the API; after that everything is purged. Audit logs follow the retention attached to your plan at the time of generation.",
  },
  {
    q: "Need something custom?",
    a: "Enterprise covers SSO/SAML, private deployments in your VPC, custom SLAs, and dedicated support. Email sales@twinmcp.dev — we usually reply within one business day.",
  },
];

export default function PlansPage() {
  return (
    <>
      {/* Hero + cards + toggle */}
      <Section
        eyebrow="Pricing"
        title="Pay for what you run, not what you might"
        description="Free tier is real — no expiry, no card. Upgrade only when you outgrow the quota."
      >
        <PricingExperience />
        <div className="mt-10 flex justify-center">
          <TrustSignals />
        </div>
      </Section>

      {/* Comparison table */}
      <Section
        bordered
        eyebrow="Compare plans"
        title="Every feature, side by side"
        description="No asterisks, no upsell pop-ups. What you see is what runs in the runtime."
      >
        <ComparisonTable />
      </Section>

      {/* FAQ */}
      <Faq
        items={pricingFaq}
        eyebrow="Pricing FAQ"
        title="Pricing questions, answered"
        description="If something's not covered here, email hello@twinmcp.dev — we read everything."
        id="pricing-faq"
      />

      {/* Final CTA */}
      <Section bordered>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-2xl border border-border/80 bg-card p-10 text-center md:p-12">
          <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Ship faster with context that lives where your agent runs.
          </h2>
          <p className="text-balance text-base text-muted-foreground">
            Start free. Upgrade when (and only when) it pays for itself.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/sign-up?plan=free" as Route}>
                Start free → no credit card
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={"/docs" as Route}>Read the docs first</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
