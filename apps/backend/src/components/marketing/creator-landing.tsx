import { Check } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { PricingExperience } from "@/components/pricing/pricing-experience";
import { TrackOnMount } from "@/components/analytics/track-event";
import { TrustSignals } from "@/components/pricing/trust-signals";
import type { CreatorCampaign } from "@/lib/promos/creators";
import type { Locale } from "@/lib/i18n/locales";

// UI strings the landing itself emits (chrome around creator-provided copy).
// Kept colocated with the component since these are the only strings that
// need translation here.
const UI = {
  en: {
    promoCode: "Promo code",
    broughtBy: (h: string) => `Brought to you by ${h}`,
    offerExpires: (d: string) => `Offer expires ${d}`,
    monthFree: (n: number) => `${n} month${n > 1 ? "s" : ""} free`,
    locale: "en-US",
  },
  fr: {
    promoCode: "Code promo",
    broughtBy: (h: string) => `Présenté par ${h}`,
    offerExpires: (d: string) => `Offre valable jusqu'au ${d}`,
    monthFree: (n: number) => `${n} mois offert${n > 1 ? "s" : ""}`,
    locale: "fr-FR",
  },
} as const;

interface Props {
  creator: CreatorCampaign;
  locale: Locale;
}

export function CreatorLanding({ creator, locale }: Props) {
  const t = UI[locale];
  const hero = creator.hero[locale];
  const promo = {
    promotionCodeId: creator.promotionCodeId,
    creatorSlug: creator.slug,
    appliesTo: creator.plan,
    cadence: creator.cadence === "monthly" ? ("monthly" as const) : ("annual" as const),
    badge: t.monthFree(creator.freeMonths),
  };

  return (
    <>
      <TrackOnMount
        name="promo_viewed"
        properties={{ creatorSlug: creator.slug, humanCode: creator.humanCode }}
      />

      <Section eyebrow={hero.eyebrow} title={hero.title} description={hero.description}>
        <div className="mx-auto mb-12 max-w-2xl">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.04] p-6">
            <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  {t.promoCode}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-tight">
                  {creator.humanCode}
                </p>
                {creator.handle && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.broughtBy(creator.handle)}
                  </p>
                )}
              </div>
              <ul className="space-y-1.5 text-sm">
                {hero.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            {creator.expiresAt && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t.offerExpires(new Date(creator.expiresAt).toLocaleDateString(t.locale))}
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
