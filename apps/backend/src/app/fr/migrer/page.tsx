import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/seo/json-ld";
import {
  ASSISTANT_COPY,
  ASSISTANT_PATHS,
  MigrateAssistant,
} from "@/components/marketing/migrate-assistant";
import { breadcrumbListSchema } from "@/lib/seo/schema";
import { trackPageServed } from "@/lib/analytics/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = ASSISTANT_PATHS.fr;
const T = ASSISTANT_COPY.fr;

export const metadata: Metadata = {
  title: T.title,
  description: T.description,
  alternates: {
    canonical: PATH,
    languages: { en: ASSISTANT_PATHS.en, fr: PATH, "x-default": ASSISTANT_PATHS.en },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: T.title,
    description: T.description,
    locale: "fr_FR",
  },
  twitter: { card: "summary_large_image", title: T.title, description: T.description },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MigrerPage({ searchParams }: { searchParams: SearchParams }) {
  // Page vue côté serveur, sans cookie (UTM / hôte référent) : les réponses sur
  // les forums et Discord pointent ici, le trafic est compté même sans consentement.
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
            { name: "Assistant de migration Smithery", url: PATH },
          ]),
        ]}
      />
      <MigrateAssistant locale="fr" />
    </>
  );
}
