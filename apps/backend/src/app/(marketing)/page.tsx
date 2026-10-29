import type { Metadata } from "next";
import { headers } from "next/headers";
import { Hero, FinalCta } from "@/components/marketing/hero";
import { SmitheryNotice } from "@/components/marketing/smithery-notice";
import { IdeLogosBar } from "@/components/marketing/ide-logos-bar";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MarketplacePreview } from "@/components/marketing/marketplace-preview";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { SocialProof } from "@/components/marketing/social-proof";
import { Faq, defaultFaqItems } from "@/components/marketing/faq";
import { TrackOnMount } from "@/components/analytics/track-event";
import { AttributionLinks } from "@/components/analytics/attribution-links";
import { trackPageServed } from "@/lib/analytics/server";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { marketingOffers } from "@/components/pricing/pricing-data";

export const metadata: Metadata = {
  title: { absolute: "MCP Server Hosting Without Managing Infra — TwinMCP" },
  description:
    "Host any MCP server — from the catalogue, stdio included, or your own npm or PyPI package — in an isolated sandbox, reachable from Cursor, Claude Code, VS Code and every MCP client. Flat price, free tier, no credit card.",
  // Mirror the FR home's hreflang so the pair points both ways (the FR page
  // advertises en/fr/x-default; without this the EN page would drop the fr alt).
  alternates: {
    canonical: "/",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
};

// Facts only: MCPs run on Node.js (npm, via npx) or Python (PyPI, via uvx)
// inside the box, and a stdio→Streamable HTTP bridge (supergateway) exposes
// each one; clients reach it through the control-plane proxy URL.
const homeHowTo = howToSchema({
  name: "How to run an MCP server with TwinMCP",
  description:
    "Host a Model Context Protocol server in an isolated sandbox and connect it to Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline or Zed with one URL and one API key.",
  totalTime: "PT2M",
  steps: [
    {
      name: "Create a TwinMCP account",
      text: "Sign up for free — no credit card required. You get one server and access to the MCP catalogue.",
      url: "/sign-up",
    },
    {
      name: "Provision a server",
      text: "Create a server: TwinMCP starts an isolated Upstash Box sandbox.",
    },
    {
      name: "Install MCPs",
      text: "Choose from 70+ MCPs (Fetch, Wikipedia, Notion, Linear, Postgres, Slack…) or, on Pro, publish your own npm (Node.js) or PyPI (Python) package. Stdio servers are bridged to Streamable HTTP inside the sandbox.",
    },
    {
      name: "Connect your AI client",
      text: "Copy the MCP's URL (https://twinmcp.fr/api/mcp/<server>/<mcp>) and an API key, then paste the config block the dashboard generates into Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline or Zed.",
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
            description:
              "TwinMCP hosts any Model Context Protocol server — from the catalogue, stdio included, or your own npm or PyPI package — in an isolated sandbox reachable over Streamable HTTP from every MCP client. Flat monthly price, no usage meters.",
            offers: marketingOffers(),
          }),
          faqPageSchema(defaultFaqItems),
          homeHowTo,
        ]}
      />
      <TrackOnMount name="landing_view" properties={{ locale: "en" }} />
      <AttributionLinks />
      <SmitheryNotice locale="en" renderedAt={Date.now()} />
      <Hero />
      <IdeLogosBar />
      <div className={CV}>
        <SocialProof />
      </div>
      <div className={CV}>
        <ProblemSolution />
      </div>
      <div className={CV}>
        <HowItWorks />
      </div>
      <div className={CV}>
        <MarketplacePreview />
      </div>
      <div className={CV}>
        <PricingTeaser />
      </div>
      <div className={CV}>
        <Faq variant="list" />
      </div>
      <div className={CV}>
        <FinalCta />
      </div>
    </>
  );
}
