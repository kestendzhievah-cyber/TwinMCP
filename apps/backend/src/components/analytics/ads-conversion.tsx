"use client";

import { useEffect } from "react";
import { ADS_CONSENT_EVENT } from "@/lib/analytics/consent";
import { SUBSCRIPTION_CONVERSION, trackAdsConversion } from "@/lib/analytics/google-ads";

/** Fires the Google Ads "Abonnement" conversion on the checkout success page.
 *  Sends immediately if advertising consent is already granted, or as soon as
 *  the visitor grants it on this page. Renders no DOM. */
export function SubscriptionConversion({
  transactionId,
  value,
  currency,
}: {
  transactionId: string;
  value: number;
  currency: string;
}) {
  useEffect(() => {
    const send = () =>
      trackAdsConversion({ sendTo: SUBSCRIPTION_CONVERSION, value, currency, transactionId });
    send();
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail === "granted") send();
    };
    window.addEventListener(ADS_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ADS_CONSENT_EVENT, onConsent);
  }, [transactionId, value, currency]);

  return null;
}
