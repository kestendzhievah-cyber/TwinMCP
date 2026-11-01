import type { Metadata } from "next";
import { headers } from "next/headers";
import { Hero, FinalCta } from "@/components/marketing/hero";
import { IdeLogosBar } from "@/components/marketing/ide-logos-bar";
import { OfferBand } from "@/components/marketing/offer-band";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MarketplacePreview } from "@/components/marketing/marketplace-preview";
import { UseCasesStrip } from "@/components/marketing/use-cases-strip";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { SocialProof } from "@/components/marketing/social-proof";
import { Faq, defaultFaqItems } from "@/components/marketing/faq";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { TrackOnMount } from "@/components/analytics/track-event";
import { AttributionLinks } from "@/components/analytics/attribution-links";
import { trackPageServed } from "@/lib/analytics/server";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { marketingOffers } from "@/components/pricing/pricing-data";
import { SIGNUP_OFFER } from "@/components/pricing/wallet-copy";

export const metadata: Metadata = {
  title: { absolute: "MCP Server Hosting Without Managing Infra — TwinMCP" },
  description:
    "Host any MCP server — from the catalogue, stdio included, or your own npm or PyPI package — in an isolated sandbox, reachable from Cursor, Claude Code, VS Code and every MCP client. Pay as you go, no subscription, free credit to start.",
  // Mirror the FR home's hreflang so the pair points both ways (the FR page
  // advertises en/fr/x-default; without this the EN page would drop the fr alt).
  alternates: {
    canonical: "/",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
};

// Facts only: MCPs run on Node.js (npm, via npx) or Python (PyPI, via uvx)
// inside the box, and a stdio→Streamable HTTP bridge (supergateway) exposes
// each one; clients reach it through the control-plane proxy URL. The three
// steps mirror the "How it works" cards (components/marketing/how-it-works.tsx).
const homeHowTo = howToSchema({
  name: "How to run an MCP server with TwinMCP",
  description:
    "Host a Model Context Protocol server in an isolated sandbox and connect it to Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline or Zed with one URL and one API key.",
  totalTime: "PT2M",
  steps: [
    {
      name: "Sign up",
      text: `Create a TwinMCP account: ${SIGNUP_OFFER.en}, available the moment the account exists.`,
      url: "/sign-up",
    },
    {
      name: "Pick an MCP",
      text: "Add one from the catalogue of 70+ MCPs (Fetch, Wikipedia, Notion, Linear, Postgres…) in one click or, after your first top-up, publish your own npm (Node.js) or PyPI (Python) package. It runs in an isolated sandbox, and stdio servers are bridged to Streamable HTTP for you.",
    },
    {
      name: "Paste the URL in your client",
      text: "Copy the config block the dashboard generates (the MCP’s URL, https://twinmcp.fr/api/mcp/<server>/<mcp>, and an API key) into Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline or Zed.",
      url: "/docs",
    },
  ],
});

// Skip rendering off-screen sections until they're scrolled near — cuts the
// initial layout/paint work on this long landing page (a Lighthouse "forced
// reflow"/render win). A fixed `contain-intrinsic-size` reserves a stable 640px
// placeholder per section so the scrollbar stays put on load (no CLS) — and,
// unlike the `auto` keyword, it's honored on every browser that supports
// content-visibility. Unsupported browsers ignore it and render normally.
const CV = "[content-visibility:auto] [contain-intrinsic-size:640px]";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Server-side denominator of the funnel: counted for every visitor, whatever
  // their cookie choice (cookieless, anonymous; see lib/analytics/server.ts).
  trackPageServed({
    path: "/",
    locale: "en",
    searchParams: await searchParams,
    headers: await headers(),
  });

  return (
    <>
      <JsonLd
        data={[
          softwareApplicationSchema({
            description: `TwinMCP hosts any Model Context Protocol server — from the catalogue, stdio included, or your own npm or PyPI package — in an isolated sandbox reachable over Streamable HTTP from every MCP client. Pay as you go from a prepaid balance, no subscription, ${SIGNUP_OFFER.en}.`,
            offers: marketingOffers(),
          }),
          faqPageSchema(defaultFaqItems),
          homeHowTo,
        ]}
      />
      <TrackOnMount name="landing_view" properties={{ locale: "en" }} />
      <AttributionLinks />
      {/* Paid traffic lands here: the offer comes first (hero + what the credit
          buys), then how it works, the catalogue, use cases, the price, trust,
          objections and a closing CTA that restates the terms. */}
      <Hero />
      <IdeLogosBar />
      <div className={CV}>
        <OfferBand />
      </div>
      <div className={CV}>
        <HowItWorks />
      </div>
      <div className={CV}>
        <MarketplacePreview />
      </div>
      <div className={CV}>
        <UseCasesStrip />
      </div>
      <div className={CV}>
        <PricingTeaser />
      </div>
      <div className={CV}>
        <SocialProof />
      </div>
      <div className={CV}>
        <Faq variant="list" />
      </div>
      <div className={CV}>
        <FinalCta />
      </div>
      <StickyMobileCta />
    </>
  );
}
