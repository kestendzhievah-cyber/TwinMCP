"use client";

import { useState } from "react";
import { PricingToggle } from "./pricing-toggle";
import { PricingCards, type PromoOffer } from "./pricing-cards";
import type { BillingCadence } from "./pricing-data";
import type { Locale } from "@/lib/i18n/locales";

interface PricingExperienceProps {
  promo?: PromoOffer;
  locale?: Locale;
}

export function PricingExperience({ promo, locale = "en" }: PricingExperienceProps) {
  // Annual first: it is the better deal (€135 a year = €11.25 a month) and the
  // monthly price is one click away. A creator promo is price-scoped, so its
  // own cadence wins — otherwise the promo card would start hidden.
  const [cadence, setCadence] = useState<BillingCadence>(promo?.cadence ?? "annual");

  return (
    <div className="flex flex-col items-center gap-10">
      <PricingToggle cadence={cadence} onChange={setCadence} locale={locale} />
      <div className="w-full">
        <PricingCards cadence={cadence} promo={promo} locale={locale} />
      </div>
    </div>
  );
}
