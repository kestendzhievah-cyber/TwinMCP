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

// Conversion actions (Google Ads > Objectifs > Conversions). An empty send_to
// makes the matching tracker a no-op, so a conversion can ship before its
// action exists in Google Ads.
/** "Abonnement": a paid or trialing subscription (value = amount paid). */
export const SUBSCRIPTION_CONVERSION =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIPTION_SEND_TO || "AW-18520591061/Kp_qCIyKsKEdENWVp_9E";
/** "Inscription": a confirmed sign-up (value set in Google Ads). */
export const SIGNUP_CONVERSION = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO || "";
/** "Demande de démo": an enterprise demo or sales request (value set in Google Ads). */
export const DEMO_CONVERSION = process.env.NEXT_PUBLIC_GOOGLE_ADS_DEMO_SEND_TO || "";

/**
 * Normalizes an email the way Google's enhanced conversions expect before
 * hashing: trimmed, lower-cased, and with the dots of the local part removed
 * for gmail.com / googlemail.com addresses.
 */
export function normalizeEmailForAds(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.replace(/\./g, "")}@${domain}`;
  }
  return e;
}

/** Hex SHA-256 of a string (Web Crypto: browsers and Node 20+). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface AdsConversionInput {
  sendTo: string;
  /** Dedupe key: Google drops repeats with the same transaction_id. */
  transactionId: string;
  /** Omit to use the default value configured on the conversion action. */
  value?: number;
  currency?: string;
  /** Enhanced conversions: sent only as a SHA-256 hash, never in clear. */
  email?: string | null;
}

/**
 * Sends a conversion once advertising consent is granted. Loads the tag first
 * if needed (gtag queues the event behind config). Resolves to whether it was
 * sent. A per-transaction flag in localStorage avoids re-sending on reloads.
 */
export async function trackAdsConversion(conv: AdsConversionInput): Promise<boolean> {
  if (typeof window === "undefined" || !conv.sendTo || !hasAdsConsent()) return false;
  const flag = `twinmcp_ads_conv_${conv.transactionId}`;
  try {
    if (window.localStorage.getItem(flag)) return false;
    // Claim the flag before the async hash so a double effect can't send twice.
    window.localStorage.setItem(flag, "1");
  } catch {
    /* storage disabled — rely on Google's transaction_id dedupe */
  }
  loadGoogleAds();
  const gtag = gtagFn();
  if (conv.email) {
    try {
      const hashed = await sha256Hex(normalizeEmailForAds(conv.email));
      gtag("set", "user_data", { sha256_email_address: hashed });
    } catch {
      /* no Web Crypto (very old browser): send the conversion without it */
    }
  }
  gtag("event", "conversion", {
    send_to: conv.sendTo,
    transaction_id: conv.transactionId,
    ...(conv.value !== undefined ? { value: conv.value, currency: conv.currency ?? "EUR" } : {}),
  });
  return true;
}

/** Fires the "Demande de démo" conversion after a successful enterprise form. */
export function trackDemoConversion(email: string): void {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  void trackAdsConversion({ sendTo: DEMO_CONVERSION, transactionId: `demo-${id}`, email });
}
