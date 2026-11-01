import Link from "next/link";
import type { Metadata, Route } from "next";
import { ArrowRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { OfferBadge, offerCopy } from "@/components/marketing/offer-badge";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { PricingExperience } from "@/components/pricing/pricing-experience";
import { TrustSignals } from "@/components/pricing/trust-signals";
import { ComparisonTable } from "@/components/pricing/comparison-table";
import { TrackOnMount } from "@/components/analytics/track-event";
import { JsonLd } from "@/components/seo/json-ld";
import { faqPageSchema, breadcrumbListSchema } from "@/lib/seo/schema";
import { FUNDED_UNLOCKS, walletFacts, walletProductSchema } from "@/components/pricing/wallet-copy";

// Every price on this page comes from lib/wallet/pricing.ts through
// components/pricing/wallet-copy.ts (publicPriceTable, whatTenEuroBuys).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const W = walletFacts("en");

export const metadata: Metadata = {
  title: "Pricing",
  description: `Pay as you go, no subscription. ${W.signupCredit} of free credit at sign-up, no card. Tool calls ${W.per1000Calls} per 1,000, compute from ${W.cpuHour.small} per active CPU-hour. Stops at zero: no surprise bills.`,
  alternates: {
    canonical: "/plans",
    languages: { en: "/plans", fr: "/fr/tarifs", "x-default": "/plans" },
  },
  openGraph: {
    title: `TwinMCP Pricing — pay as you go, ${W.signupCredit} free to start`,
    description: `A prepaid balance, no subscription. ${W.signupCredit} of free credit at sign-up, top-ups from ${W.minTopup}, and calls stop at zero.`,
    url: "/plans",
  },
};

const pricingFaq: FaqItem[] = [
  {
    q: `How does the ${W.signupCredit} sign-up credit work?`,
    a: `Every new account gets ${W.signupCredit} of promotional credit, without a card. It is valid ${W.signupDays} days from sign-up, one per person, and it is spent before any credit you buy. It runs ${W.creditServers} small server with the catalogue MCPs, except those that run shell commands, code or a headless browser: they wait for your first top-up. Unused promotional credit expires at the end of the ${W.signupDays} days; it has no cash value.`,
  },
  {
    q: "What exactly is charged?",
    a: `Two things. Tool calls that reach your MCP server cost ${W.per1000Calls} per 1,000, tool errors included. Compute is the active CPU time your server uses, as the box measures it: ${W.cpuHour.small} per CPU-hour on a small server; ${W.largerSizes}. Connecting a client, listing tools and pings are not charged as tool calls, but the CPU time they use is part of compute; calls TwinMCP refuses are not charged. A paused server uses no CPU time, an awake but idle one very little, and servers pause on their own after a period without activity.`,
  },
  {
    q: "What happens when my balance reaches zero?",
    a: `Tool calls are refused with HTTP 402 and a clear message pointing to the billing page, and your servers pause. Nothing is charged to a card unless you turned auto-recharge on, so there is no surprise bill. Compute that was already running when the balance hit zero can take it slightly below zero (at most ${W.overdraft}); that is taken from your next top-up. Top up and you can start your servers again.`,
  },
  {
    q: "How do top-ups work?",
    a: `From the billing page, pick ${W.presets.join(", ")} or any amount from ${W.minTopup} to ${W.maxTopup}, and pay by card through Stripe. VAT is calculated at checkout where it applies. ${FUNDED_UNLOCKS.en}`,
  },
  {
    q: "What is auto-recharge?",
    a: "An option, off by default. When your balance falls below a threshold you choose, TwinMCP tops it up with the amount you chose, on the card you saved, up to a monthly cap you set. You can change it or turn it off at any time from the billing page.",
  },
  {
    q: "Does credit expire?",
    a: `The sign-up credit expires ${W.signupDays} days after sign-up. Credit you paid for has no expiry date: it remains available while your account is open.`,
  },
  {
    q: "Is there a subscription or a monthly fee?",
    a: "No. Nothing renews and nothing is billed on a schedule. You pay when you top up, and your balance goes down with the tool calls and the compute your servers use.",
  },
  {
    q: "I had a Pro subscription. What happens to it?",
    a: "Pro subscriptions are being converted to credit: the unused part of your current period is added to your balance as paid credit, the subscription is cancelled so it no longer renews, and you get an email with the amounts. Your servers, MCPs and API keys stay as they are.",
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
          walletProductSchema({ siteUrl: SITE_URL, path: "/plans", locale: "en" }),
          faqPageSchema(pricingFaq.map((f) => ({ q: f.q, a: f.a as string }))),
        ]}
      />
      <TrackOnMount name="pricing_view" />

      {/* Hero: the offer first (pill, the € figure in the H1, the CTA label),
          then the terms line, so the free credit is never oversold. */}
      <section className="bg-background pb-14 pt-10 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <OfferBadge />
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Pay as you go. <span className="text-primary">{W.signupCredit} free</span> to start.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            No subscription. You top up a prepaid balance and pay only for what your servers use:
            tool calls and active CPU time. At zero, everything stops: no surprise bills.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="xl" className="w-full sm:w-auto">
              <Link href={"/sign-up" as Route} id="hero-cta" data-cta-location="pricing_hero">
                Get {W.signupCredit} of free credit
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <a href="#estimator">
                <Calculator aria-hidden />
                Estimate your cost
              </a>
            </Button>
          </div>
          <TrustSignals className="mt-6" />
        </div>
      </section>

      {/* Price list, what the credit buys, then the estimator. */}
      <Section
        id="prices"
        className="scroll-mt-16 bg-surface-alt"
        eyebrow="Price list"
        title="Pay only for what you use"
        description={`Two meters, both in euros: tool calls and active CPU time. Top up from ${W.minTopup} when you need more.`}
      >
        <PricingExperience />
      </Section>

      {/* Before and after the first top-up */}
      <Section
        eyebrow="Your account"
        title="Free credit, then pay as you go"
        description="Same prices before and after your first top-up. Funding the account lifts the limits that keep the free credit from being abused."
      >
        <ComparisonTable />
      </Section>

      {/* FAQ on the alternate band */}
      <div className="bg-surface-alt">
        <Faq
          items={pricingFaq}
          eyebrow="Pricing FAQ"
          title="Pricing questions, answered"
          description="If something's not covered here, email hello@twinmcp.fr. We read everything."
          id="pricing-faq"
        />
      </div>

      {/* Final CTA: a strong-band panel (never navy: a rose button on navy fails contrast). */}
      <section id="final-cta" data-sticky-cta-hide className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl bg-surface-band p-8 text-center md:p-14">
            <OfferBadge />
            <h2 className="mt-5 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight md:text-4xl">
              Your first hosted MCP server, live in about 2 minutes.
            </h2>
            <p className="mt-4 max-w-xl text-balance text-lg text-muted-foreground">
              Start with {W.signupCredit} on us. Top up only when you need more.
            </p>
            <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button asChild size="xl" className="w-full sm:w-auto">
                <Link href={"/sign-up" as Route} data-cta-location="pricing_final">
                  {offerCopy("en").cta}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
                <Link href={"/docs#credit" as Route}>How credit works</Link>
              </Button>
            </div>
            <TrustSignals className="mt-6" />
          </div>
        </div>
      </section>
      <StickyMobileCta />
    </>
  );
}
