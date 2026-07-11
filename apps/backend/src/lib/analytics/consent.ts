// Analytics-cookie consent, stored client-side.
//
// CNIL / CPDP (ePrivacy): non-essential cookies (PostHog analytics) MUST NOT be
// set before the user opts in, and withdrawing consent must be as easy as
// granting it. Essential cookies (the Supabase session) are exempt and always on.
//
// This module is the single source of truth for that consent bit. It is plain
// (no "use client") and SSR-safe via typeof-window guards, so it can be imported
// from anywhere; on the server it always reports "unset".

const KEY = "twinmcp_cookie_consent";

export type ConsentState = "granted" | "denied" | "unset";

/** Fired on the window when consent changes; PostHogProvider listens for it. */
export const CONSENT_EVENT = "twinmcp:consent";
/** Fired to re-open the banner (withdrawal / change of mind). */
export const OPEN_COOKIE_SETTINGS = "twinmcp:open-cookie-settings";

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

export function setConsent(state: "granted" | "denied"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, state);
  } catch {
    /* storage disabled — treat as session-only choice */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "granted";
}

/** Re-open the consent banner from anywhere (e.g. a footer "Cookies" link). */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS));
}
