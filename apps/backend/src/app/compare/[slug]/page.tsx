import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { CompareDetail } from "../_components/compare-view";
import { COMPARISONS, compareLanguages, comparePath, getComparison } from "@/lib/compare/data";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

type Params = Promise<{ slug: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) return {};
  const path = comparePath("en", comparison);
  const title = comparison.title.en;
  const description = comparison.description.en;
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
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CompareSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();
  const path = comparePath("en", comparison);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Compare", url: comparePath("en") },
            { name: comparison.them.en, url: path },
          ]),
          faqPageSchema(comparison.faq.en),
        ]}
      />
      <CompareDetail locale="en" comparison={comparison} />
    </>
  );
}
