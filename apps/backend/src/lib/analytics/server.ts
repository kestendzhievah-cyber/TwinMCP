// Server-side mirror for funnel events that originate in server actions or
// API routes (e.g. auth/callback firing signup_completed when the cookie is
// set). Uses the public ingestion endpoint — the project API key is also the
// public one, so no extra secret is needed. Server → PostHog directly (not via
// the browser's /ingest proxy).
//
// Fire-and-forget: never block a response on telemetry.

import { readAttribution, referrerHost } from "./attribution";

// `||`, not `??`: the Docker build passes an unset build arg as "".
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

/**
 * Server-side funnel events (documented names; client events live in
 * lib/analytics/funnel.ts). Properties:
 * - signup_completed{via:"server", method, locale?, ...attribution}
 * - server_created, mcp_installed{mcpSlug}, key_created, first_tool_call{mcpSlug}
 * - rate_limited{plan}
 * - trial_started{cadence}, trial_converted{cadence, amount}, plan_upgraded,
 *   promo_redeemed, subscription_canceled{reason}, checkout_expired
 * - upgrade_email_sent (Free → Pro nudges)
 * - page_served{path, locale, utm_*, gclid_present, referrer_host} (cookieless)
 */
export type ServerFunnelEventName =
  | "signup_completed"
  | "server_created"
  | "mcp_installed"
  | "key_created"
  | "first_tool_call"
  | "rate_limited"
  | "trial_started"
  | "trial_converted"
  | "plan_upgraded"
  | "promo_redeemed"
  | "subscription_canceled"
  | "checkout_expired"
  | "upgrade_email_sent"
  | "page_served";

interface ServerEvent {
  // Autocompletes the documented names, still accepts any string.
  event: ServerFunnelEventName | (string & {});
  distinctId: string;
  properties?: Record<string, unknown>;
}

export function trackServer(event: ServerEvent): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event: event.event,
      distinct_id: event.distinctId,
      timestamp: new Date().toISOString(),
      properties: { ...(event.properties ?? {}), $lib: "twinmcp-server" },
    }),
  }).catch((err) => {
    // PostHog should never break the user flow.
    console.warn("[analytics/server] capture failed:", err);
  });
}

// Crawlers, link unfurlers, uptime probes and scripted clients: not visitors.
const NON_HUMAN_UA =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|facebookexternalhit|embedly|whatsapp|telegram|curl|wget|python-|httpclient|go-http-client|node-fetch|axios/i;

function isPrefetch(headers: Headers): boolean {
  return (
    headers.has("next-router-prefetch") ||
    headers.has("x-middleware-prefetch") ||
    /prefetch/i.test(headers.get("purpose") ?? "") ||
    /prefetch/i.test(headers.get("sec-purpose") ?? "")
  );
}

function ownHost(headers: Headers): string {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  return raw.split(",")[0].trim().split(":")[0].toLowerCase();
}

export interface PageServedInput {
  path: string;
  locale: "en" | "fr";
  searchParams?: Record<string, string | string[] | undefined>;
  headers?: Headers;
}

/** The page_served properties, or null when the request should not count. */
export function pageServedProperties(input: PageServedInput): Record<string, unknown> | null {
  const h = input.headers;
  if (h) {
    if (isPrefetch(h)) return null;
    const ua = h.get("user-agent") ?? "";
    if (!ua || NON_HUMAN_UA.test(ua)) return null;
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input.searchParams ?? {})) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string") params.set(k, first);
  }
  const a = readAttribution(params);
  const ref = referrerHost(h?.get("referer"));
  const external = ref && h && ref !== ownHost(h) ? ref : undefined;

  return {
    path: input.path,
    locale: input.locale,
    utm_source: a?.utm_source,
    utm_medium: a?.utm_medium,
    utm_campaign: a?.utm_campaign,
    utm_term: a?.utm_term,
    gclid_present: Boolean(a?.gclid),
    referrer_host: external,
    // "client" = a soft navigation inside the site (RSC request), "document" =
    // a full page load (ads, search, direct).
    navigation: h?.has("rsc") ? "client" : "document",
  };
}

/**
 * Counts a landing page render: the denominator of the funnel, independent of
 * the cookie banner. Cookieless and anonymous: a constant distinct id, no
 * person profile, no GeoIP, no IP or user agent forwarded. Fire-and-forget.
 */
export function trackPageServed(input: PageServedInput): void {
  try {
    const properties = pageServedProperties(input);
    if (!properties) return;
    trackServer({
      event: "page_served",
      distinctId: "server",
      properties: { ...properties, $process_person_profile: false, $geoip_disable: true },
    });
  } catch (err) {
    console.warn("[analytics/server] page_served skipped:", err);
  }
}
