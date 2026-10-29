import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/seo/json-ld";
import { DEMO_FAQ, DemoContent } from "@/components/marketing/demo-content";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";
import { trackPageServed } from "@/lib/analytics/server";
import { DEMO_PATHS, parseDemoBundle, parseDemoTopic } from "@/lib/sales/demo-request";
import { demoPackSummary } from "@/lib/solutions/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = DEMO_PATHS.fr;

const TITLE = "Installation accompagnée : nous installons vos serveurs MCP";
const DESCRIPTION =
  "Pour les équipes qui veulent qu’on installe leurs MCP à leur place : un serveur TwinMCP, un pack de MCP, les clés API et la connexion à votre client IA. Offre Pro plus des frais d’installation uniques, chiffrés après l’appel.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: { en: DEMO_PATHS.en, fr: PATH, "x-default": DEMO_PATHS.en },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: TITLE,
    description: DESCRIPTION,
    locale: "fr_FR",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DemoPageFr({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Page vue côté serveur, sans cookie (UTM / gclid / hôte référent).
  trackPageServed({ path: PATH, locale: "fr", searchParams: params, headers: await headers() });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Installation accompagnée", url: PATH },
          ]),
          faqPageSchema(DEMO_FAQ.fr),
        ]}
      />
      {/* ?topic=dpa|security présélectionne l’objet (liens depuis /fr/securite) ;
          ?bundle=<pack> indique le pack MCP (liens depuis /fr/solutions). */}
      <DemoContent
        locale="fr"
        initialTopic={parseDemoTopic(params.topic)}
        initialPack={demoPackSummary(parseDemoBundle(params.bundle), "fr")}
      />
    </>
  );
}
