import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/seo/json-ld";
import { DEMO_FAQ, DemoContent } from "@/components/marketing/demo-content";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";
import { trackPageServed } from "@/lib/analytics/server";
import { DEMO_PATHS, parseDemoBundle, parseDemoTopic } from "@/lib/sales/demo-request";
import { demoPackSummary } from "@/lib/solutions/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = DEMO_PATHS.en;

const TITLE = "Guided setup: we set up your MCP servers";
const DESCRIPTION =
  "For teams that want their MCP stack set up for them: a TwinMCP server, a pack of MCPs, API keys and the connection in your AI client. Pro plan plus a one-time setup fee quoted after the call.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: { en: PATH, fr: DEMO_PATHS.fr, "x-default": PATH },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DemoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Cookieless server-side page view (UTM / gclid / referrer host).
  trackPageServed({ path: PATH, locale: "en", searchParams: params, headers: await headers() });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Guided setup", url: PATH },
          ]),
          faqPageSchema(DEMO_FAQ.en),
        ]}
      />
      {/* ?topic=dpa|security pre-selects the subject (links from /security);
          ?bundle=<pack> names the MCP pack (links from /solutions). */}
      <DemoContent
        locale="en"
        initialTopic={parseDemoTopic(params.topic)}
        initialPack={demoPackSummary(parseDemoBundle(params.bundle), "en")}
      />
    </>
  );
}
