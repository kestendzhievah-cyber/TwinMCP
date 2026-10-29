import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { CompareHub } from "./_components/compare-view";
import { COMPARISONS, compareLanguages, comparePath } from "@/lib/compare/data";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = comparePath("en");

const TITLE = "Compare TwinMCP with Composio, Smithery and self-hosting";
const DESCRIPTION =
  "Honest, sourced comparisons of TwinMCP with Composio, Smithery and self-hosting your MCP servers: what each one does better, dated sources, no ratings.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH, languages: compareLanguages() },
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

export default function ComparePage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Compare", url: PATH },
          ]),
          itemListSchema(COMPARISONS.map((c) => ({ name: c.title.en, url: comparePath("en", c) }))),
        ]}
      />
      <CompareHub locale="en" />
    </>
  );
}
