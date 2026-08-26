import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { IdeLogosBar } from "@/components/marketing/ide-logos-bar";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MarketplacePreview } from "@/components/marketing/marketplace-preview";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { SocialProof } from "@/components/marketing/social-proof";
import { Faq, defaultFaqItems } from "@/components/marketing/faq";
import { TrackOnMount } from "@/components/analytics/track-event";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "TwinMCP — Run your MCP servers without managing infra",
  description:
    "Provision MCP runtimes, install MCPs from a curated marketplace, connect Cursor, Claude Code, and Windsurf in 2 minutes. Free tier — no credit card.",
  // Mirror the FR home's hreflang so the pair points both ways (the FR page
  // advertises en/fr/x-default; without this the EN page would drop the fr alt).
  alternates: {
    canonical: "/",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
};

const homeHowTo = howToSchema({
  name: "How to run an MCP server with TwinMCP",
  description:
    "Provision a Model Context Protocol server in an isolated runtime and connect it to Cursor, Claude Code, Windsurf, or Cline.",
  totalTime: "PT2M",
  steps: [
    {
      name: "Create a TwinMCP account",
      text: "Sign up for free — no credit card required. You get one server and access to the official MCP catalog.",
      url: "/sign-up",
    },
    {
      name: "Provision a server",
      text: "Pick a runtime (Node.js, Python, Go, Ruby, or Rust). TwinMCP spins up an isolated Upstash Box sandbox in seconds.",
    },
    {
      name: "Install MCPs from the marketplace",
      text: "One-click install GitHub, Notion, Linear, Postgres, Slack, and dozens more curated MCPs into your server.",
    },
    {
      name: "Connect your AI coding agent",
      text: "Copy the server endpoint and API key, then paste them into Cursor, Claude Code, Windsurf, or Cline.",
      url: "/docs",
    },
  ],
});

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          softwareApplicationSchema({
            offers: [
              { name: "Free", price: "0", url: "/plans" },
              { name: "Pro", price: "20", url: "/plans" },
              { name: "Team", price: "50", url: "/plans" },
            ],
          }),
          faqPageSchema(defaultFaqItems),
          homeHowTo,
        ]}
      />
      <TrackOnMount name="landing_view" />
      <Hero />
      <IdeLogosBar />
      <ProblemSolution />
      <HowItWorks />
      <MarketplacePreview />
      <PricingTeaser />
      <SocialProof />
      <Faq />
    </>
  );
}
