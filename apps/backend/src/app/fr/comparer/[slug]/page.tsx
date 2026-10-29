import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { CompareDetail } from "@/app/compare/_components/compare-view";
import {
  COMPARISONS,
  compareLanguages,
  comparePath,
  getComparisonByFrSlug,
} from "@/lib/compare/data";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

type Params = Promise<{ slug: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.frSlug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparisonByFrSlug(slug);
  if (!comparison) return {};
  const path = comparePath("fr", comparison);
  const title = comparison.title.fr;
  const description = comparison.description.fr;
  return {
    title,
    description,
    alternates: { canonical: path, languages: compareLanguages(comparison) },
    openGraph: {
      type: "article",
      siteName: "TwinMCP",
      url: `${SITE_URL}${path}`,
      title,
      description,
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ComparerSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const comparison = getComparisonByFrSlug(slug);
  if (!comparison) notFound();
  const path = comparePath("fr", comparison);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Comparer", url: comparePath("fr") },
            { name: comparison.them.fr, url: path },
          ]),
          faqPageSchema(comparison.faq.fr),
        ]}
      />
      <CompareDetail locale="fr" comparison={comparison} />
    </>
  );
}
