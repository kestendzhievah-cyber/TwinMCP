import type { Metadata } from "next";
import { SolutionsIndexView } from "@/app/solutions/_components/solution-view";
import { solutionAlternates } from "@/lib/solutions/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const ALT = solutionAlternates(null, "fr");

const TITLE = "Stacks MCP par métier : essentiel, développeurs, recherche, data, finance";
const DESCRIPTION =
  "Des packs de départ de serveurs MCP hébergés, un par type d’équipe : ce que fait chaque MCP, les clés à fournir, ce que votre assistant IA peut en faire. Installation par vous-même ou avec nous.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ALT.canonical, languages: ALT.languages },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${ALT.canonical}`,
    title: TITLE,
    description: DESCRIPTION,
    locale: "fr_FR",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function SolutionsPageFr() {
  return <SolutionsIndexView locale="fr" />;
}
