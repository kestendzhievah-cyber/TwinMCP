import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CreatorLanding } from "@/components/marketing/creator-landing";
import { getCreator } from "@/lib/promos/creators";

interface Params {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const creator = getCreator(slug);
  if (!creator) return {};
  const hero = creator.hero.fr;
  const title = `${creator.freeMonths} mois de TwinMCP Pro offert${creator.freeMonths > 1 ? "s" : ""} — ${creator.displayName}`;
  return {
    title,
    description: hero.description,
    alternates: {
      canonical: `/fr/p/${creator.slug}`,
      languages: { en: `/p/${creator.slug}`, fr: `/fr/p/${creator.slug}` },
    },
    openGraph: {
      title,
      description: hero.description,
      url: `/fr/p/${creator.slug}`,
      type: "website",
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image", title, description: hero.description },
    robots: { index: false, follow: true },
  };
}

export default async function CreatorLandingFr({ params }: Params) {
  const { slug } = await params;
  const creator = getCreator(slug);
  if (!creator) notFound();
  return <CreatorLanding creator={creator} locale="fr" />;
}
