import type { Metadata } from "next";
import { headers } from "next/headers";
import { Hero, FinalCta } from "@/components/marketing/hero";
import { SmitheryNotice } from "@/components/marketing/smithery-notice";
import { IdeLogosBar } from "@/components/marketing/ide-logos-bar";
import { SocialProof } from "@/components/marketing/social-proof";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MarketplacePreview } from "@/components/marketing/marketplace-preview";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { Faq, frFaqItems } from "@/components/marketing/faq";
import { TrackOnMount } from "@/components/analytics/track-event";
import { AttributionLinks } from "@/components/analytics/attribution-links";
import { trackPageServed } from "@/lib/analytics/server";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { marketingOffers } from "@/components/pricing/pricing-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: { absolute: "Hébergement de serveurs MCP, sans gérer l'infra — TwinMCP" },
  description:
    "TwinMCP héberge vos serveurs Model Context Protocol dans des runtimes isolés. Installez des MCPs depuis le catalogue, connectez Cursor, Claude Code et Windsurf en 2 minutes. Offre gratuite — sans carte bancaire.",
  alternates: {
    canonical: "/fr",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}/fr`,
    title: "Hébergement de serveurs MCP, sans gérer l'infra — TwinMCP",
    description:
      "Provisionnez des serveurs MCP isolés, installez depuis le catalogue, connectez Cursor / Claude Code / Windsurf en 2 minutes.",
    locale: "fr_FR",
  },
};

// Faits uniquement : les MCP tournent sous Node.js (npm, via npx) ou Python
// (PyPI, via uvx) dans la box, et un pont stdio → Streamable HTTP
// (supergateway) expose chacun d'eux derrière l'URL du proxy.
const howToFr = howToSchema({
  name: "Comment lancer un serveur MCP avec TwinMCP",
  description:
    "Hébergez un serveur Model Context Protocol dans un sandbox isolé et connectez-le à Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline ou Zed avec une URL et une clé API.",
  totalTime: "PT2M",
  steps: [
    {
      name: "Créer un compte TwinMCP",
      text: "Inscription gratuite, sans carte bancaire. Vous obtenez un serveur et l'accès au catalogue MCP.",
      url: "/fr/inscription",
    },
    {
      name: "Provisionner un serveur",
      text: "Créez un serveur : TwinMCP démarre un sandbox Upstash Box isolé.",
    },
    {
      name: "Installer des MCP",
      text: "Choisissez parmi plus de 70 MCP (Fetch, Wikipedia, Notion, Linear, Postgres, Slack…) ou, avec Pro, publiez votre propre paquet npm (Node.js) ou PyPI (Python). Les serveurs stdio sont reliés à Streamable HTTP dans le sandbox.",
    },
    {
      name: "Connecter votre client IA",
      text: "Copiez l'URL du MCP (https://twinmcp.fr/api/mcp/<serveur>/<mcp>) et une clé API, puis collez le bloc de configuration généré par le tableau de bord dans Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline ou Zed.",
      url: "/fr/docs",
    },
  ],
});

// Skip rendering off-screen sections until scrolled near — cuts the initial
// layout/paint work on this long page (the Lighthouse forced-reflow / render
// item). A fixed contain-intrinsic-size reserves a stable 640px placeholder per
// section (no CLS on load) and — unlike the `auto` keyword — is honored on every
// browser that supports content-visibility. Unsupported browsers ignore it.
const CV = "[content-visibility:auto] [contain-intrinsic-size:640px]";

export default async function FrHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Server-side denominator of the funnel: counted for every visitor, whatever
  // their cookie choice (cookieless, anonymous; see lib/analytics/server.ts).
  trackPageServed({
    path: "/fr",
    locale: "fr",
    searchParams: await searchParams,
    headers: await headers(),
  });

  return (
    <>
      <JsonLd
        data={[
          softwareApplicationSchema({
            description:
              "TwinMCP héberge n'importe quel serveur Model Context Protocol (catalogue, serveurs stdio compris, ou votre propre paquet npm ou PyPI) dans un sandbox isolé, accessible en Streamable HTTP depuis tous les clients MCP. Prix mensuel fixe, sans facturation à l'usage.",
            offers: marketingOffers(),
          }),
          faqPageSchema(frFaqItems),
          howToFr,
        ]}
      />
      <TrackOnMount name="landing_view" properties={{ locale: "fr" }} />
      <AttributionLinks />
      {/* Paid traffic lands here: the offer that the ads promise comes first
          (hero + product), then proof, objections, the catalogue, the price and
          a closing CTA that restates the risk reversal. */}
      <SmitheryNotice locale="fr" renderedAt={Date.now()} />
      <Hero locale="fr" />
      <IdeLogosBar locale="fr" />
      <div className={CV}>
        <SocialProof locale="fr" />
      </div>
      <div className={CV}>
        <ProblemSolution locale="fr" />
      </div>
      <div className={CV}>
        <HowItWorks locale="fr" />
      </div>
      <div className={CV}>
        <MarketplacePreview locale="fr" />
      </div>
      <div className={CV}>
        <PricingTeaser locale="fr" />
      </div>
      <div className={CV}>
        <Faq
          locale="fr"
          variant="list"
          title="Questions fréquentes"
          description="Sécurité, clients IA, offre gratuite : les réponses avant de commencer. Une question manque ? Écrivez à hello@twinmcp.fr."
        />
      </div>
      <div className={CV}>
        <FinalCta locale="fr" />
      </div>
    </>
  );
}
