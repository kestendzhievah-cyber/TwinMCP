import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/seo/json-ld";
import {
  MIGRATION_PATHS,
  SMITHERY_MIGRATION_FAQ,
  SmitheryMigration,
} from "@/components/marketing/smithery-migration";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";
import { trackPageServed } from "@/lib/analytics/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = MIGRATION_PATHS.fr;

const TITLE = "Migrer depuis Smithery avant le 31 octobre";
const DESCRIPTION =
  "Le proxy hébergé, les URL, l’API et les comptes Smithery ferment le 31 octobre 2026. Déplacez vos serveurs MCP vers TwinMCP : mêmes paquets MCP, secrets chiffrés par serveur, une URL et une clé API par MCP. Offre gratuite, sans carte bancaire.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: { en: MIGRATION_PATHS.en, fr: PATH, "x-default": MIGRATION_PATHS.en },
  },
  // L'image vient de l'opengraph-image racine (la carte de visite par défaut).
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: "Smithery ferme le 31 octobre — déplacez vos serveurs MCP vers TwinMCP",
    description: DESCRIPTION,
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smithery ferme le 31 octobre — déplacez vos serveurs MCP vers TwinMCP",
    description: DESCRIPTION,
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MigrerDepuisSmitheryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Page vue côté serveur, sans cookie (UTM / gclid / hôte référent), pour
  // compter le trafic payant de cette landing même sans consentement.
  trackPageServed({
    path: PATH,
    locale: "fr",
    searchParams: await searchParams,
    headers: await headers(),
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Migrer depuis Smithery", url: PATH },
          ]),
          faqPageSchema(SMITHERY_MIGRATION_FAQ.fr),
        ]}
      />
      <SmitheryMigration locale="fr" />
    </>
  );
}
