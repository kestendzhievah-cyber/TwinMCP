// Cookie consent, stored client-side, one choice per purpose.
//
// CNIL / CPDP (ePrivacy): non-essential cookies MUST NOT be set before the user
// opts in, consent must be specific to each purpose, and withdrawing it must be
// as easy as granting it. Essential cookies (the Supabase session) are exempt
// and always on.
//
// Purposes:
// - analytics: audience measurement (PostHog)
// - ads: advertising measurement (Google Ads tag)
//
// This module is the single source of truth for those consent bits. It is plain
// (no "use client") and SSR-safe via typeof-window guards, so it can be imported
// from anywhere; on the server it always reports "unset".

// The analytics key predates the per-purpose split; keeping its name preserves
// every visitor's existing PostHog choice.
const ANALYTICS_KEY = "twinmcp_cookie_consent";
const ADS_KEY = "twinmcp_ads_consent";

export type ConsentState = "granted" | "denied" | "unset";
export type ConsentChoice = "granted" | "denied";

/** Fired on the window when analytics consent changes; PostHogProvider listens. */
export const CONSENT_EVENT = "twinmcp:consent";
/** Fired on the window when advertising consent changes; GoogleAdsTag listens. */
export const ADS_CONSENT_EVENT = "twinmcp:ads-consent";
/** Fired to re-open the banner (withdrawal / change of mind). */
export const OPEN_COOKIE_SETTINGS = "twinmcp:open-cookie-settings";

function read(key: string): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(key);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

function write(key: string, state: ConsentChoice): void {
  try {
    window.localStorage.setItem(key, state);
  } catch {
    /* storage disabled — treat as session-only choice */
  }
}

/** Analytics (PostHog) consent. */
export function getConsent(): ConsentState {
  return read(ANALYTICS_KEY);
}

/** Advertising (Google Ads) consent. */
export function getAdsConsent(): ConsentState {
  return read(ADS_KEY);
}

/** True while at least one purpose has no recorded choice: the banner shows. */
export function needsConsentChoice(): boolean {
  return getConsent() === "unset" || getAdsConsent() === "unset";
}

/** Records one choice per purpose and notifies the listeners of each. */
export function setConsentChoices(choices: { analytics: ConsentChoice; ads: ConsentChoice }): void {
  if (typeof window === "undefined") return;
  write(ANALYTICS_KEY, choices.analytics);
  write(ADS_KEY, choices.ads);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choices.analytics }));
  window.dispatchEvent(new CustomEvent(ADS_CONSENT_EVENT, { detail: choices.ads }));
}

/** "Accept all" / "Reject all": the same choice for every purpose. */
export function setConsent(state: ConsentChoice): void {
  setConsentChoices({ analytics: state, ads: state });
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "granted";
}

export function hasAdsConsent(): boolean {
  return getAdsConsent() === "granted";
}

/** Re-open the consent banner from anywhere (e.g. a footer "Cookies" link). */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS));
}
