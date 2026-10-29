// First-touch attribution: which campaign / click / referral brought a visitor.
//
// Pure and client-safe (no storage, no network). CNIL: the ad click ids travel
// in the URL only, from the landing page to the sign-up form, and then land on
// the user's own account (users.metadata.attribution) once they sign up. Nothing
// is written to the visitor's device, so no consent is needed to carry them.
//
// Consumers:
// - components/analytics/attribution-links.tsx: forwards the keys from the
//   landing URL onto the sign-up / pricing / onboarding links.
// - lib/analytics/funnel.ts: first-touch properties of pre-consent events.
// - lib/analytics/server.ts: page_served (utm_* and gclid presence).
// - lib/billing/checkout.ts: Stripe session + subscription metadata.

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "ref",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export type Attribution = Partial<Record<AttributionKey, string>> & {
  landing_path?: string;
  locale?: "en" | "fr";
  referrer_host?: string;
  first_seen_at?: string;
};

/** Longest value kept per key: real utm/gclid values are far shorter. */
export const ATTRIBUTION_MAX_LENGTH = 200;

function clean(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v) return undefined;
  return v.slice(0, ATTRIBUTION_MAX_LENGTH);
}

function toParams(search: string | URLSearchParams): URLSearchParams {
  if (typeof search !== "string") return search;
  // Accept a full URL as well as "?a=b" / "a=b".
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(search)) {
    try {
      return new URL(search).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }
  const q = search.indexOf("?");
  const raw = q >= 0 ? search.slice(q + 1) : search;
  return new URLSearchParams(raw.split("#")[0]);
}

/** Host of a referrer URL ("https://www.google.com/search?q=…" → "www.google.com"). */
export function referrerHost(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host ? host.slice(0, ATTRIBUTION_MAX_LENGTH) : undefined;
  } catch {
    return undefined;
  }
}

/** True when the attribution carries at least one campaign key (utm_*, gclid, ref). */
export function hasAttributionKeys(attribution: Attribution | null | undefined): boolean {
  if (!attribution) return false;
  return ATTRIBUTION_KEYS.some((k) => Boolean(attribution[k]));
}

/**
 * Reads the attribution keys from a query string. Unknown keys are ignored,
 * values are trimmed and truncated to 200 characters. Returns null when the
 * query carries none of ATTRIBUTION_KEYS: an organic visit has nothing to
 * forward. `extra` adds the landing context (path, locale, referrer host).
 */
export function readAttribution(
  search: string | URLSearchParams,
  extra?: { path?: string; locale?: "en" | "fr"; referrer?: string }
): Attribution | null {
  const params = toParams(search);
  const out: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = clean(params.get(key));
    if (value) out[key] = value;
  }
  if (!hasAttributionKeys(out)) return null;

  const path = clean(extra?.path);
  if (path) out.landing_path = path;
  if (extra?.locale === "en" || extra?.locale === "fr") out.locale = extra.locale;
  const host = referrerHost(extra?.referrer);
  if (host) out.referrer_host = host;
  out.first_seen_at = new Date().toISOString();
  return out;
}

/**
 * Appends the attribution keys to `href` as query params. Params already on the
 * link win (never overwritten, never duplicated); the fragment is kept. Only
 * ATTRIBUTION_KEYS travel, never the landing context. Fragment-only and
 * non-http links (mailto:, tel:…) are returned unchanged.
 */
export function withAttribution(href: string, attribution: Attribution | null): string {
  if (!attribution || !hasAttributionKeys(attribution)) return href;
  if (!href || href.startsWith("#")) return href;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href);
  if (scheme && !/^https?$/i.test(scheme[1])) return href;

  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = beforeHash.indexOf("?");
  const base = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : "");

  let added = false;
  for (const key of ATTRIBUTION_KEYS) {
    const value = clean(attribution[key]);
    if (!value || params.has(key)) continue;
    params.append(key, value);
    added = true;
  }
  if (!added) return href;
  return `${base}?${params.toString()}${hash}`;
}

/** Only the campaign keys, as plain strings (for metadata / event properties). */
export function attributionKeys(
  attribution: Attribution | null | undefined
): Partial<Record<AttributionKey, string>> {
  const out: Partial<Record<AttributionKey, string>> = {};
  if (!attribution) return out;
  for (const key of ATTRIBUTION_KEYS) {
    const value = clean(attribution[key]);
    if (value) out[key] = value;
  }
  return out;
}
