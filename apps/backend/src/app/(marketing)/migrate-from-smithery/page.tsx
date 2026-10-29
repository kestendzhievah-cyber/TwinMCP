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
const PATH = MIGRATION_PATHS.en;

const TITLE = "Migrate from Smithery before 31 October";
const DESCRIPTION =
  "Smithery's hosted proxy, URLs, API and accounts shut down on 31 October 2026. Move your MCP servers to TwinMCP: same MCP packages, encrypted per-server secrets, one URL and API key per MCP. Free plan, no credit card.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: { en: PATH, fr: MIGRATION_PATHS.fr, "x-default": PATH },
  },
  // The image comes from the root opengraph-image (the default business card).
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: "Smithery shuts down on 31 October — move your MCP servers to TwinMCP",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smithery shuts down on 31 October — move your MCP servers to TwinMCP",
    description: DESCRIPTION,
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MigrateFromSmitheryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Cookieless server-side page view (UTM / gclid / referrer host), so ad
  // traffic to this landing is counted even without analytics consent.
  trackPageServed({
    path: PATH,
    locale: "en",
    searchParams: await searchParams,
    headers: await headers(),
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Migrate from Smithery", url: PATH },
          ]),
          faqPageSchema(SMITHERY_MIGRATION_FAQ.en),
        ]}
      />
      <SmitheryMigration locale="en" />
    </>
  );
}
