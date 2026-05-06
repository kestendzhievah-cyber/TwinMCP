import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { IdeLogosBar } from "@/components/marketing/ide-logos-bar";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MarketplacePreview } from "@/components/marketing/marketplace-preview";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { SocialProof } from "@/components/marketing/social-proof";
import { Faq } from "@/components/marketing/faq";

export const metadata: Metadata = {
  title: "TwinMCP — Run your MCP servers without managing infra",
  description:
    "Provision MCP runtimes, install MCPs from a curated marketplace, connect Cursor, Claude Code, and Windsurf in 2 minutes. Free tier — no credit card.",
  alternates: { canonical: "/" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TwinMCP",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "TwinMCP runs Model Context Protocol servers in isolated runtimes for AI coding agents (Cursor, Claude Code, Windsurf, Cline).",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "20", priceCurrency: "USD" },
    { "@type": "Offer", name: "Team", price: "50", priceCurrency: "USD" },
  ],
  publisher: { "@type": "Organization", name: "TwinMCP", url: SITE_URL },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify is safe here — content is fully static and trusted.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
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
