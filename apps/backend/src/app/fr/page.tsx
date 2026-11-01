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
import { Faq, frFaqItems } from "@/components/marketing/faq";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { TrackOnMount } from "@/components/analytics/track-event";
import { AttributionLinks } from "@/components/analytics/attribution-links";
import { trackPageServed } from "@/lib/analytics/server";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { marketingOffers } from "@/components/pricing/pricing-data";
import { SIGNUP_OFFER, walletFacts } from "@/components/pricing/wallet-copy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

/** "10 €": the sign-up credit, from the wallet price list. */
const FR_CREDIT = walletFacts("fr").signupCredit;

export const metadata: Metadata = {
  title: { absolute: "Hébergement de serveurs MCP, sans gérer l’infra — TwinMCP" },
  description:
    "TwinMCP héberge vos serveurs Model Context Protocol dans des runtimes isolés. Installez des MCPs depuis le catalogue, connectez Cursor, Claude Code et Windsurf en 2 minutes. Paiement à l’usage, sans abonnement, crédit offert pour commencer.",
  alternates: {
    canonical: "/fr",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}/fr`,
    title: "Hébergement de serveurs MCP, sans gérer l’infra — TwinMCP",
    description:
      "Provisionnez des serveurs MCP isolés, installez depuis le catalogue, connectez Cursor / Claude Code / Windsurf en 2 minutes.",
    locale: "fr_FR",
  },
};

// Faits uniquement : les MCP tournent sous Node.js (npm, via npx) ou Python
// (PyPI, via uvx) dans la box, et un pont stdio → Streamable HTTP
// (supergateway) expose chacun d’eux derrière l’URL du proxy. Les trois étapes
// reprennent les cartes « Comment ça marche » (components/marketing/how-it-works.tsx).
const howToFr = howToSchema({
  name: "Comment lancer un serveur MCP avec TwinMCP",
  description:
    "Hébergez un serveur Model Context Protocol dans un sandbox isolé et connectez-le à Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline ou Zed avec une URL et une clé API.",
  totalTime: "PT2M",
  steps: [
    {
      name: "Inscrivez-vous",
      text: `Créez un compte TwinMCP : ${SIGNUP_OFFER.fr}, disponible dès la création du compte.`,
      url: "/fr/inscription",
    },
    {
      name: "Choisissez un MCP",
      text: "Ajoutez en un clic l’un des plus de 70 MCP du catalogue (Fetch, Wikipedia, Notion, Linear, Postgres…) ou, après votre première recharge, publiez votre propre paquet npm (Node.js) ou PyPI (Python). Il tourne dans un sandbox isolé, et les serveurs stdio sont pontés vers Streamable HTTP pour vous.",
    },
    {
      name: "Collez l’URL dans votre client",
      text: "Copiez le bloc de configuration généré par le tableau de bord (l’URL du MCP, https://twinmcp.fr/api/mcp/<serveur>/<mcp>, et une clé API) dans Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline ou Zed.",
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
            description: `TwinMCP héberge n’importe quel serveur Model Context Protocol (catalogue, serveurs stdio compris, ou votre propre paquet npm ou PyPI) dans un sandbox isolé, accessible en Streamable HTTP depuis tous les clients MCP. Paiement à l’usage depuis un solde prépayé, sans abonnement, ${FR_CREDIT} offerts à l’inscription.`,
            offers: marketingOffers(),
          }),
          faqPageSchema(frFaqItems),
          howToFr,
        ]}
      />
      <TrackOnMount name="landing_view" properties={{ locale: "fr" }} />
      <AttributionLinks />
      {/* Paid traffic lands here: the offer the ads promise comes first (hero
          + what the credit buys), then how it works, the catalogue, use cases,
          the price, trust, objections and a closing CTA restating the terms. */}
      <Hero locale="fr" />
      <IdeLogosBar locale="fr" />
      <div className={CV}>
        <OfferBand locale="fr" />
      </div>
      <div className={CV}>
        <HowItWorks locale="fr" />
      </div>
      <div className={CV}>
        <MarketplacePreview locale="fr" />
      </div>
      <div className={CV}>
        <UseCasesStrip locale="fr" />
      </div>
      <div className={CV}>
        <PricingTeaser locale="fr" />
      </div>
      <div className={CV}>
        <SocialProof locale="fr" />
      </div>
      <div className={CV}>
        <Faq
          locale="fr"
          variant="list"
          title="Questions fréquentes"
          description={
            "Sécurité, clients IA, crédit offert : les réponses avant de commencer. Une question manque ? Écrivez à hello@twinmcp.fr."
          }
        />
      </div>
      <div className={CV}>
        <FinalCta locale="fr" />
      </div>
      <StickyMobileCta locale="fr" />
    </>
  );
}
