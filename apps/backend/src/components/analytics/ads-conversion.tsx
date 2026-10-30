"use client";

import { useEffect, useState } from "react";
import { ADS_CONSENT_EVENT } from "@/lib/analytics/consent";
import {
  SIGNUP_CONVERSION,
  SUBSCRIPTION_CONVERSION,
  topupConversionSendTo,
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

type ConversionProps = { transactionId: string; value: number; currency: string };

/**
 * A paid wallet top-up, on /dashboard/billing?topup=success. Always rendered
 * (pass null when there is nothing to report): it latches the first verified
 * conversion it receives, so the success banner stripping ?topup and the
 * refreshes that follow (the page re-renders without a conversion) do not
 * unmount the consent listener before a visitor without consent can grant it.
 * Reports to the "Recharge" action when NEXT_PUBLIC_GOOGLE_ADS_TOPUP_SEND_TO
 * was set at build time, otherwise to the existing "Abonnement" action. The
 * value is net of VAT, in EUR; transaction_id is the Checkout session id, so
 * Google drops a repeat of the same top-up.
 */
export function TopupConversion(props: {
  conversion: ConversionProps | null;
  email?: string | null;
}) {
  const [latched, setLatched] = useState<ConversionProps | null>(props.conversion);
  const incoming = props.conversion;
  useEffect(() => {
    if (incoming) setLatched(incoming);
    // Keyed on the session: a new top-up replaces the latched one.
  }, [incoming?.transactionId]);
  if (!latched) return null;
  return (
    <AdsConversion
      sendTo={topupConversionSendTo()}
      transactionId={latched.transactionId}
      value={latched.value}
      currency={(latched.currency || "EUR").toUpperCase()}
      email={props.email}
    />
  );
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
