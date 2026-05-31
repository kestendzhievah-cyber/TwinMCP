"use client";

import { useState } from "react";
import { PricingToggle } from "./pricing-toggle";
import { PricingCards, type PromoOffer } from "./pricing-cards";
import type { BillingCadence } from "./pricing-data";

interface PricingExperienceProps {
  promo?: PromoOffer;
}

export function PricingExperience({ promo }: PricingExperienceProps) {
  const [cadence, setCadence] = useState<BillingCadence>("monthly");

  return (
    <div className="flex flex-col items-center gap-10">
      <PricingToggle cadence={cadence} onChange={setCadence} />
      <div className="w-full">
        <PricingCards cadence={cadence} promo={promo} />
      </div>
    </div>
  );
}
