import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { CompareHub } from "@/app/compare/_components/compare-view";
import { COMPARISONS, compareLanguages, comparePath } from "@/lib/compare/data";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = comparePath("fr");

const TITLE = "Comparer TwinMCP à Composio, Smithery et l’auto-hébergement";
const DESCRIPTION =
  "Des comparatifs honnêtes et sourcés de TwinMCP face à Composio, Smithery et l’auto-hébergement de vos serveurs MCP : ce que chacun fait mieux, sources datées, aucune note.";

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
    locale: "fr_FR",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ComparerPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Comparer", url: PATH },
          ]),
          itemListSchema(COMPARISONS.map((c) => ({ name: c.title.fr, url: comparePath("fr", c) }))),
        ]}
      />
      <CompareHub locale="fr" />
    </>
  );
}
