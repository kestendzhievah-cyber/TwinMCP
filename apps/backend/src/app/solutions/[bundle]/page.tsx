import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SolutionView } from "../_components/solution-view";
import { getSolutionBySlug, solutionAlternates, solutionSlugs } from "@/lib/solutions/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

type Params = Promise<{ bundle: string }>;

// One static page per pack; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return solutionSlugs("en").map((bundle) => ({ bundle }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { bundle } = await params;
  const solution = getSolutionBySlug(bundle, "en");
  if (!solution) return {};
  const c = solution.en;
  const alt = solutionAlternates(solution, "en");
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: alt.canonical, languages: alt.languages },
    openGraph: {
      type: "website",
      siteName: "TwinMCP",
      url: `${SITE_URL}${alt.canonical}`,
      title: c.metaTitle,
      description: c.metaDescription,
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title: c.metaTitle, description: c.metaDescription },
  };
}

export default async function SolutionPage({ params }: { params: Params }) {
  const { bundle } = await params;
  const solution = getSolutionBySlug(bundle, "en");
  if (!solution) notFound();
  return <SolutionView solution={solution} locale="en" />;
}
