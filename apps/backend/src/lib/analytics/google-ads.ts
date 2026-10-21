// Google Ads tag (gtag.js).
//
// Loaded ONLY after the visitor grants advertising consent (CNIL): nothing is
// requested from Google before that. Consent Mode v2 signals are still sent
// (default denied, then granted) so that a later withdrawal in the same session
// can switch the tag back to denied.

import { hasAdsConsent } from "./consent";

// The tag ID is public (it appears in every page's source), so a default is
// fine; NEXT_PUBLIC_GOOGLE_ADS_ID can override it at build time.
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-18520591061";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

// Advertising consent covers ad measurement only; analytics stays with PostHog.
const GRANTED = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "denied",
} as const;

let loaded = false;

function gtagFn(): Gtag {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    // gtag.js reads the raw `arguments` object, not an array copy.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  return window.gtag;
}

/** Loads the tag once consent is granted. Safe to call repeatedly. */
export function loadGoogleAds(): void {
  if (typeof window === "undefined" || !GOOGLE_ADS_ID || !hasAdsConsent()) return;
  const gtag = gtagFn();
  if (loaded) {
    gtag("consent", "update", GRANTED);
    return;
  }
  loaded = true;
  gtag("consent", "default", DENIED);
  gtag("consent", "update", GRANTED);
  gtag("js", new Date());
  gtag("config", GOOGLE_ADS_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_ID)}`;
  document.head.appendChild(script);
}

/** Withdrawal: tells the tag consent is denied and clears its first-party cookies. */
export function revokeGoogleAds(): void {
  if (typeof window === "undefined") return;
  if (loaded && window.gtag) window.gtag("consent", "update", DENIED);
  const host = window.location.hostname;
  const domains = ["", `; domain=${host}`, `; domain=.${host.replace(/^www\./, "")}`];
  for (const raw of document.cookie.split(";")) {
    const name = raw.split("=")[0]?.trim();
    if (!name || !(name.startsWith("_gcl") || name.startsWith("_gac"))) continue;
    for (const d of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    }
  }
}

/** Page view for client-side navigations (the first one is sent by `config`). */
export function trackAdsPageview(path: string): void {
  if (!loaded || !window.gtag) return;
  window.gtag("event", "page_view", { page_path: path, send_to: GOOGLE_ADS_ID });
}

/** "Abonnement" conversion action (a paid or trialing subscription). */
export const SUBSCRIPTION_CONVERSION =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIPTION_SEND_TO || "AW-18520591061/Kp_qCIyKsKEdENWVp_9E";

/**
 * Sends a conversion once advertising consent is granted. Loads the tag first
 * if needed (gtag queues the event behind config). Returns whether it was sent.
 * transaction_id lets Google drop duplicates; a per-transaction flag in
 * localStorage also avoids re-sending on every reload of the page.
 */
export function trackAdsConversion(conv: {
  sendTo: string;
  value: number;
  currency: string;
  transactionId: string;
}): boolean {
  if (typeof window === "undefined" || !hasAdsConsent()) return false;
  const flag = `twinmcp_ads_conv_${conv.transactionId}`;
  try {
    if (window.localStorage.getItem(flag)) return false;
  } catch {
    /* storage disabled — rely on Google's transaction_id dedupe */
  }
  loadGoogleAds();
  gtagFn()("event", "conversion", {
    send_to: conv.sendTo,
    value: conv.value,
    currency: conv.currency,
    transaction_id: conv.transactionId,
  });
  try {
    window.localStorage.setItem(flag, "1");
  } catch {
    /* ignore */
  }
  return true;
}
