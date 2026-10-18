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
        {/* The voucher is a card lifted off the stack: eyebrow, the code in typewriter,
            the offer's terms ruled on the right, the expiry as an address line. */}
        <div className="mx-auto mb-12 max-w-2xl md:mb-16">
          <div className="border border-foreground/70 bg-card shadow-stack">
            <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="flex flex-col items-center p-6 text-center md:items-start md:p-8 md:text-left">
                <p className="eyebrow">{t.promoCode}</p>
                <p className="lining mt-3 font-mono text-3xl font-medium text-foreground">
                  {creator.humanCode}
                </p>
                {creator.handle && (
                  <p className="mt-2 text-sm italic text-muted-foreground">
                    {t.broughtBy(creator.handle)}
                  </p>
                )}
              </div>
              <ul className="divide-y divide-border px-6 py-4 text-base md:px-8 md:py-6">
                {hero.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 py-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-success" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            {creator.expiresAt && (
              <p className="smallcaps tracking-sc lining border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
                {t.offerExpires(new Date(creator.expiresAt).toLocaleDateString(t.locale))}
              </p>
            )}
          </div>
        </div>

        <PricingExperience promo={promo} locale={locale} />

        <div className="mt-10 flex justify-center">
          <TrustSignals locale={locale} />
        </div>
      </Section>
    </>
  );
}
