import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SolutionView } from "@/app/solutions/_components/solution-view";
import { getSolutionBySlug, solutionAlternates, solutionSlugs } from "@/lib/solutions/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

type Params = Promise<{ bundle: string }>;

// Une page statique par pack ; tout autre slug renvoie une 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return solutionSlugs("fr").map((bundle) => ({ bundle }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { bundle } = await params;
  const solution = getSolutionBySlug(bundle, "fr");
  if (!solution) return {};
  const c = solution.fr;
  const alt = solutionAlternates(solution, "fr");
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
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image", title: c.metaTitle, description: c.metaDescription },
  };
}

export default async function SolutionPageFr({ params }: { params: Params }) {
  const { bundle } = await params;
  const solution = getSolutionBySlug(bundle, "fr");
  if (!solution) notFound();
  return <SolutionView solution={solution} locale="fr" />;
}
