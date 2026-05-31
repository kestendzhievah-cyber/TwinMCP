import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Section } from "@/components/marketing/section";
import { PricingExperience } from "@/components/pricing/pricing-experience";
import { TrackOnMount } from "@/components/analytics/track-event";
import { TrustSignals } from "@/components/pricing/trust-signals";
import { getCreator, listCreatorSlugs } from "@/lib/promos/creators";
import { Check } from "lucide-react";

interface Params {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return listCreatorSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const creator = getCreator(slug);
  if (!creator) return {};

  const title = `${creator.freeMonths} month of TwinMCP Pro free — ${creator.displayName}`;
  const description = creator.hero.description;

  return {
    title,
    description,
    alternates: { canonical: `/p/${creator.slug}` },
    openGraph: {
      title,
      description,
      url: `/p/${creator.slug}`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false, follow: true },
  };
}

export default async function CreatorLanding({ params }: Params) {
  const { slug } = await params;
  const creator = getCreator(slug);
  if (!creator) notFound();

  const promo = {
    promotionCodeId: creator.promotionCodeId,
    creatorSlug: creator.slug,
    appliesTo: creator.plan,
    cadence: creator.cadence === "monthly" ? ("monthly" as const) : ("annual" as const),
    badge: `${creator.freeMonths} month${creator.freeMonths > 1 ? "s" : ""} free`,
  };

  return (
    <>
      <TrackOnMount
        name="promo_viewed"
        properties={{ creatorSlug: creator.slug, humanCode: creator.humanCode }}
      />

      <Section
        eyebrow={creator.hero.eyebrow}
        title={creator.hero.title}
        description={creator.hero.description}
      >
        <div className="mx-auto mb-12 max-w-2xl">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.04] p-6">
            <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  Promo code
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-tight">
                  {creator.humanCode}
                </p>
                {creator.handle && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Brought to you by {creator.handle}
                  </p>
                )}
              </div>
              <ul className="space-y-1.5 text-sm">
                {creator.hero.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            {creator.expiresAt && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Offer expires {new Date(creator.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <PricingExperience promo={promo} />

        <div className="mt-10 flex justify-center">
          <TrustSignals />
        </div>
      </Section>
    </>
  );
}

