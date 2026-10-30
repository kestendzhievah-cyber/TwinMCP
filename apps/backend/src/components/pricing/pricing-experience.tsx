import type { Locale } from "@/lib/i18n/locales";
import { PriceTable } from "./price-table";
import { CostEstimator } from "./cost-estimator";
import { PRICE_TABLE } from "./wallet-copy";

/**
 * A creator campaign's offer, as components/marketing/creator-landing.tsx
 * builds it. Creator promo codes were Stripe coupons on the retired Pro
 * subscription: there is nothing to apply them to in the prepaid wallet, so
 * the prop is accepted (the landing still compiles and shows the code) but not
 * rendered here.
 */
export interface PromoOffer {
  promotionCodeId: string;
  creatorSlug: string;
  appliesTo: "pro";
  cadence: "monthly" | "annual";
  badge: string;
}

interface PricingExperienceProps {
  /** Accepted for the creator landing; unused since the wallet replaced Pro. */
  promo?: PromoOffer;
  locale?: Locale;
}

// The pricing block shared by /plans, /fr/tarifs and the creator landings: the
// public price list (and what the sign-up credit buys), then the estimator.
// The price list is read once on the server and handed to the client
// estimator, so the browser never re-derives a price from its own env.
export function PricingExperience({ locale = "en" }: PricingExperienceProps) {
  return (
    <div className="flex flex-col gap-10">
      <PriceTable locale={locale} table={PRICE_TABLE} />
      <CostEstimator locale={locale} table={PRICE_TABLE} />
    </div>
  );
}
