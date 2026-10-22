"use client";

import { useEffect } from "react";
import { ADS_CONSENT_EVENT } from "@/lib/analytics/consent";
import {
  SIGNUP_CONVERSION,
  SUBSCRIPTION_CONVERSION,
  trackAdsConversion,
  type AdsConversionInput,
} from "@/lib/analytics/google-ads";

/** Fires a Google Ads conversion once: immediately if advertising consent is
 *  already granted, or as soon as the visitor grants it on this page. Renders
 *  no DOM. */
function AdsConversion(props: AdsConversionInput) {
  const { sendTo, transactionId, value, currency, email } = props;
  useEffect(() => {
    const send = () => void trackAdsConversion({ sendTo, transactionId, value, currency, email });
    send();
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail === "granted") send();
    };
    window.addEventListener(ADS_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ADS_CONSENT_EVENT, onConsent);
  }, [sendTo, transactionId, value, currency, email]);

  return null;
}

/** "Abonnement", on the checkout success page (value = amount paid). */
export function SubscriptionConversion(props: {
  transactionId: string;
  value: number;
  currency: string;
  email?: string | null;
}) {
  return <AdsConversion sendTo={SUBSCRIPTION_CONVERSION} {...props} />;
}

/** "Inscription", on the first onboarding visit after a confirmed sign-up. */
export function SignupConversion(props: { userId: string; email?: string | null }) {
  return (
    <AdsConversion
      sendTo={SIGNUP_CONVERSION}
      transactionId={`signup-${props.userId}`}
      email={props.email}
    />
  );
}
