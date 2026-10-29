import type { Metadata } from "next";
import { SolutionsIndexView } from "./_components/solution-view";
import { solutionAlternates } from "@/lib/solutions/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const ALT = solutionAlternates(null, "en");

const TITLE = "MCP stacks by team: essentials, developers, research, data, finance";
const DESCRIPTION =
  "Starting packs of hosted MCP servers, one per kind of team: what each MCP does, which keys you bring, what your AI assistant can do with it. Set it up yourself or with us.";

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
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function SolutionsPage() {
  return <SolutionsIndexView locale="en" />;
}
