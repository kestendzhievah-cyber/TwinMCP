import Link from "next/link";
import type { Metadata, Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { PricingExperience } from "@/components/pricing/pricing-experience";
import { TrustSignals } from "@/components/pricing/trust-signals";
import { ComparisonTable } from "@/components/pricing/comparison-table";
import { TrackOnMount } from "@/components/analytics/track-event";
import { JsonLd } from "@/components/seo/json-ld";
import { productPricingSchema, faqPageSchema, breadcrumbListSchema } from "@/lib/seo/schema";
import { FREE_MCP_LIMIT, PLANS } from "@/components/pricing/pricing-data";

const proMonthly = PLANS.find((p) => p.id === "pro")?.monthlyUsd ?? 14.99;

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free forever (1 server, up to ${FREE_MCP_LIMIT} MCPs + TwinMCP Docs, no credit card). Pro €${proMonthly}/mo: 50 servers, all box sizes, 5,000 tool calls a day.`,
  alternates: {
    canonical: "/plans",
    languages: { en: "/plans", fr: "/fr/tarifs", "x-default": "/plans" },
  },
  openGraph: {
    title: "TwinMCP Pricing — start free, upgrade only when you outgrow it",
    description:
      "Compare Free and Pro — servers, box sizes, daily tool calls, audit logs, support.",
    url: "/plans",
  },
};

const pricingFaq: FaqItem[] = [
  {
    q: "How does the free month of Pro work?",
    a: "Your first Pro subscription starts with 30 days free. You enter a card at checkout but are not charged during the trial; cancel anytime before it ends and you pay nothing. Otherwise Pro renews at €14.99 a month (or the annual price you picked). The free month applies once per customer; a creator promo link replaces it with that link's own offer.",
  },
  {
    q: "How does annual billing work?",
    a: "You pay 12 months up front and save up to 25% versus monthly. On a first subscription the first month is free, and the year is charged when it ends. If you cancel, the plan keeps running until the end of the period already paid; no prorated refunds.",
  },
  {
    q: "Can I switch plans later?",
    a: "Anytime, from /dashboard/billing. Upgrading to Pro takes effect as soon as checkout completes. Cancelling Pro takes effect at the end of the current billing period, so you keep what you paid for until then; your account then returns to Free.",
  },
  {
    q: "What counts toward the daily quota?",
    a: "Only tool calls — the requests where your AI actually asks an MCP to do something. Connecting, listing tools, pings and session handshakes are free, so reconnecting a client or switching IDEs never uses up your quota.",
  },
  {
    q: "What happens if I exceed my quota?",
    a: "Quotas are soft caps: existing servers keep running, but new ones (and new MCP installs above the limit) are blocked until you upgrade. Tool calls above the daily quota (50 on Free, 5,000 on Pro) are refused with a limit-reached error until the 24-hour window resets.",
  },
  {
    q: "Can usage ever cost me more than the plan price?",
    a: "No. The price is flat: €0 on Free, €14.99 a month or €135 a year on Pro. There are no per-call charges and no overage billing: at the daily cap, calls pause until the window resets, and nothing is charged for them.",
  },
  {
    q: "Do you offer discounts?",
    a: "50% off for verified non-profits, students, and active maintainers of public OSS MCPs. Email hello@twinmcp.fr with proof.",
  },
  {
    q: "What happens to my data when I cancel?",
    a: "When Pro ends, your account returns to Free. Your oldest small server keeps running; the other servers (and any medium or large box) are stopped: their runtime is shut down and files written inside it are not kept, but the servers themselves, their installed MCPs and settings, your account and your API keys stay, and upgrading again lets you start them. Audit logs are only shown on Pro.",
  },
];

export default function PlansPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Pricing", url: "/plans" },
          ]),
          productPricingSchema({
            name: "TwinMCP",
            description:
              "Hosted Model Context Protocol runtimes for AI coding agents — Free and Pro plans.",
            tiers: PLANS.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.blurb,
              priceMonthlyUsd: p.monthlyUsd,
              priceAnnualMonthlyUsd: p.annualMonthlyUsd,
              url: `/plans#${p.id}`,
            })),
          }),
          faqPageSchema(pricingFaq.map((f) => ({ q: f.q, a: f.a as string }))),
        ]}
      />
      <TrackOnMount name="pricing_view" />
      {/* Hero + cards + toggle. The header is written out (not Section's
          title prop, which renders an h2) so the page has a real h1, set in
          the same style as every other section title. */}
      <Section>
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <p className="eyebrow mb-4 flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']">
            Pricing
          </p>
          <h1 className="text-3xl font-medium md:text-4xl">
            Pay for what you run, not what you might
          </h1>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            Free tier is real — no expiry, no card. Upgrade only when you outgrow the quota.
          </p>
        </div>
        <PricingExperience />
        {/* The section's address line: facts between two hairlines. */}
        <div className="mx-auto mt-12 max-w-3xl border-y border-border py-4">
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
        description="If something's not covered here, email hello@twinmcp.fr — we read everything."
        id="pricing-faq"
      />

      {/* Final CTA: a single card on the bone page — title, a short rule, lead, buttons. */}
      <Section bordered>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 border border-border bg-card px-6 py-12 text-center shadow-sm md:px-12 md:py-14">
          <h2 className="text-balance text-3xl font-medium md:text-4xl">
            Ship faster with context that lives where your agent runs.
          </h2>
          <div className="h-px w-12 bg-foreground/40" />
          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            Start free. Upgrade when (and only when) it pays for itself.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/sign-up?plan=free" as Route}>
                Start free · no credit card
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
