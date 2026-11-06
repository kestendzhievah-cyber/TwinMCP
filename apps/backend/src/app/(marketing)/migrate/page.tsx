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
const PATH = ASSISTANT_PATHS.en;
const T = ASSISTANT_COPY.en;

export const metadata: Metadata = {
  title: T.title,
  description: T.description,
  alternates: {
    canonical: PATH,
    languages: { en: PATH, fr: ASSISTANT_PATHS.fr, "x-default": PATH },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: T.title,
    description: T.description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: T.title, description: T.description },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MigratePage({ searchParams }: { searchParams: SearchParams }) {
  // Cookieless server-side page view (UTM / referrer host): forum and Discord
  // replies link here, so the traffic is counted even without consent.
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
            { name: "Smithery migration assistant", url: PATH },
          ]),
        ]}
      />
      <MigrateAssistant locale="en" />
    </>
  );
}
