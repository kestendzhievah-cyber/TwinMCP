import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CreatorLanding } from "@/components/marketing/creator-landing";
import { getCreator } from "@/lib/promos/creators";

interface Params {
  params: Promise<{ slug: string }>;
}

// Resolve creators at request time, not build time. SSG would freeze the
// creator list into the image — adding a creator (or setting STRIPE_PROMO_*_ID)
// would require a full rebuild before the landing would 404 → 200.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const creator = getCreator(slug);
  if (!creator) return {};
  const hero = creator.hero.en;
  const title = `${creator.freeMonths} month of TwinMCP Pro free — ${creator.displayName}`;
  return {
    title,
    description: hero.description,
    alternates: {
      canonical: `/p/${creator.slug}`,
      languages: { en: `/p/${creator.slug}`, fr: `/fr/p/${creator.slug}` },
    },
    openGraph: { title, description: hero.description, url: `/p/${creator.slug}`, type: "website" },
    twitter: { card: "summary_large_image", title, description: hero.description },
    robots: { index: false, follow: true },
  };
}

export default async function CreatorLandingEn({ params }: Params) {
  const { slug } = await params;
  const creator = getCreator(slug);
  if (!creator) notFound();
  return <CreatorLanding creator={creator} locale="en" />;
}
