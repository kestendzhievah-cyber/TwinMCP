// Funnel events — single source of truth for the conversion funnel.
//
// Expected funnel in PostHog:
//   page_served{path,locale,utm_*} (server, cookieless: the denominator)
//   landing_view{locale} → cta_clicked{location,locale,target}
//                → pricing_view → signup_started{locale} → signup_submitted{locale}
//                → signup_completed{via:"server"} (auth callback, server-side)
//                → onboarding_viewed → plan_selected{plan,step} (onboarding step 0)
//                → onboarding_step_completed{step:ide|server|mcp|connect}
//                → first_server_created → first_mcp_installed
//                → connection_tested{ok} → first_tool_call (server)
//                → checkout_started → trial_started (server) → trial_converted (server)
//
// Discriminated union ensures the call site cannot use the wrong properties
// for an event. New events MUST be added here, not inlined at the call site.
// Server-side events go through lib/analytics/server.ts (ServerFunnelEventName).
//
// Consent (CNIL): posthog-js is only loaded once analytics consent is granted.
// Events tracked before that wait in an in-memory queue (no storage, nothing is
// sent): they are flushed with their original timestamp if the visitor accepts,
// and dropped if they refuse or leave.

import type { NudgeLevel, NudgeSource } from "@/lib/billing/upgrade-state";
import { ATTRIBUTION_KEYS, readAttribution, referrerHost } from "./attribution";
import { getConsent, hasAnalyticsConsent } from "./consent";

// posthog-js (~50KB gz) is loaded lazily, only after the user grants consent —
// so it never ships in the initial bundle of any page (marketing home included).
type PostHogClient = typeof import("posthog-js").default;

type Locale = "en" | "fr";
/** Where a checkout was started (mirrors CheckoutFrom in lib/billing/checkout.ts). */
type CheckoutSurface = "billing" | "onboarding" | "pricing" | "signup";

export type FunnelEvent =
  // `properties` is optional so existing property-less calls keep compiling.
  | { name: "landing_view"; properties?: { locale: Locale } }
  | {
      // A landing call-to-action was clicked. `location` names the slot
      // ("hero_primary", "header", "final", …), `target` is the link's href.
      name: "cta_clicked";
      properties: { location: string; locale: Locale; target: string };
    }
  | { name: "pricing_view" }
  // The sign-up form was shown / first interacted with.
  | { name: "signup_started"; properties?: { locale: Locale; plan?: string } }
  | { name: "oauth_clicked"; properties: { provider: "github" | "google" } }
  // The sign-up form was submitted successfully on the client. The account is
  // confirmed later: the auth callback sends signup_completed{via:"server"}.
  | {
      name: "signup_submitted";
      properties: { locale: Locale; plan?: string; method?: "password" | "magic-link" };
    }
  | { name: "resend_confirmation_clicked"; properties: { locale: Locale } }
  // The guided-setup form (/demo, /fr/demo) was sent. `clients`: how many AI
  // clients were ticked; no contact detail is ever sent to analytics.
  | {
      name: "demo_requested";
      properties: {
        locale: Locale;
        topic: "setup" | "dpa" | "security";
        teamSize: string;
        clients: number;
        /** MCP pack id when the visitor came from a solution page (?bundle=). */
        bundle?: string;
      };
    }
  // The auth callback bounced back with an error (?error= on the sign-in page).
  | { name: "auth_callback_failed"; properties: { code: string } }
  // `step`: the wizard step index the visit opened on (or its name).
  | { name: "onboarding_viewed"; properties?: { step?: number | string } }
  | { name: "activation_step_clicked"; properties: { step: string } }
  | {
      name: "onboarding_step_completed";
      // "welcome" kept for backward-compat; "ide" is the current label of that step.
      properties: { step: "welcome" | "ide" | "server" | "mcp" | "connect" };
    }
  | { name: "onboarding_skipped"; properties: { atStep: number } }
  | {
      name: "plan_selected";
      properties: {
        plan: "free" | "pro" | "team";
        step: "onboarding" | "signup";
        cadence?: "monthly" | "annual";
      };
    }
  | { name: "first_server_created"; properties: { serverId: string } }
  | { name: "first_mcp_installed"; properties: { mcpSlug: string } }
  // The "Test connection" button: ok = initialize AND tools/list succeeded.
  | {
      name: "connection_tested";
      properties: { ok: boolean; installing?: boolean; surface: "onboarding" | "server" };
    }
  | {
      // "annual" is the pricing UI word, "yearly" the checkout API one.
      name: "cadence_toggled";
      properties: { cadence: "monthly" | "yearly" | "annual"; surface: CheckoutSurface };
    }
  | {
      name: "checkout_started";
      properties: {
        plan: "free" | "pro" | "team";
        cadence?: "monthly" | "annual";
        /** Set when the checkout was initiated from a /p/[slug] creator landing. */
        creatorSlug?: string;
      };
    }
  // Back from Stripe without paying (?checkout=canceled / ?status=canceled).
  | { name: "checkout_canceled"; properties: { from: CheckoutSurface } }
  | { name: "portal_opened"; properties?: { surface?: string } }
  | {
      name: "promo_viewed";
      properties: { creatorSlug: string; humanCode: string };
    }
  // Free → Pro nudges (lib/billing/upgrade-state.ts). `source` is the surface
  // that showed the nudge, `level` how loud it was, `reason` why it fired.
  | {
      name: "upgrade_nudge_viewed";
      properties: { source: NudgeSource; level: NudgeLevel; reason: string };
    }
  | {
      name: "upgrade_cta_clicked";
      properties: { source: NudgeSource; level: NudgeLevel; reason: string };
    };

// The browser talks to PostHog through the same-origin /ingest reverse proxy
// (next.config.mjs rewrites): no third-party host to allow in the CSP, and
// blockers that drop *.posthog.com requests do not drop first-party ones.
// `||`, not `??`: the Docker build passes an unset build arg as "".
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
const POSTHOG_UI_HOST = /:\/\/us(-assets)?\.i\.posthog\.com/.test(POSTHOG_HOST)
  ? "https://us.posthog.com"
  : "https://eu.posthog.com";
const INGEST_PATH = "/ingest";

let ph: PostHogClient | null = null;
let initializing = false;

// Pre-consent queue: memory only, bounded, gone on a full page load.
interface PendingEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: Date;
}
const MAX_PENDING = 100;
let pending: PendingEvent[] = [];

// First touch, read once when the bundle first loads (i.e. on the landing page,
// before a client-side navigation drops the utm_* from the URL). Registered as
// super-properties once consent is granted, and set once on the person.
const firstTouch: Record<string, string | boolean> | null = readFirstTouch();

function readFirstTouch(): Record<string, string | boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const { pathname, search, hostname } = window.location;
    const props: Record<string, string | boolean> = { first_touch_path: pathname };
    const host = referrerHost(document.referrer);
    if (host && host !== hostname.toLowerCase()) props.first_touch_referrer_host = host;
    const attribution = readAttribution(search);
    if (attribution) {
      for (const key of ATTRIBUTION_KEYS) {
        const value = attribution[key];
        if (!value) continue;
        // The click id itself stays out of PostHog (data minimization):
        // Google Ads already has it; the funnel only needs to know it was paid.
        if (key === "gclid") props.first_touch_gclid_present = true;
        else props[`first_touch_${key}`] = value;
      }
    }
    return props;
  } catch {
    return null;
  }
}

/** First-touch properties of this page load (debugging aid). */
export function getFirstTouch(): Readonly<Record<string, string | boolean>> | null {
  return firstTouch;
}

export async function initAnalytics(): Promise<void> {
  if (ph || initializing) return;
  if (typeof window === "undefined") return;
  // No analytics cookies before the user opts in (CNIL / CPDP / ePrivacy).
  // The cookie banner calls setConsent("granted"), which re-invokes this.
  if (!hasAnalyticsConsent()) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    // No-op when the env is unset (dev without analytics, ephemeral previews).
    pending = [];
    return;
  }
  initializing = true;
  try {
    const posthog = (await import("posthog-js")).default;
    posthog.init(key, {
      api_host: INGEST_PATH,
      ui_host: POSTHOG_UI_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie",
    });
    if (firstTouch) posthog.register_once(firstTouch);
    ph = posthog;
    flushPending(posthog);
  } finally {
    initializing = false;
  }
}

function flushPending(client: PostHogClient): void {
  const queued = pending;
  pending = [];
  for (const e of queued) {
    client.capture(
      e.name,
      { ...(e.properties ?? {}), queued_before_consent: true },
      { timestamp: e.timestamp }
    );
  }
}

/** Drops the pre-consent queue (the visitor refused analytics). */
export function discardPendingAnalytics(): void {
  pending = [];
}

export function isAnalyticsReady(): boolean {
  return ph !== null;
}

export function track(event: FunnelEvent): void {
  const properties = "properties" in event ? event.properties : undefined;
  if (ph) {
    ph.capture(event.name, properties);
    return;
  }
  // Queue only while the choice is pending (or posthog-js is still loading);
  // a visitor who refused analytics is never queued.
  if (typeof window === "undefined" || pending.length >= MAX_PENDING) return;
  if (getConsent() === "denied") return;
  pending.push({
    name: event.name,
    properties: properties ? { ...properties } : undefined,
    timestamp: new Date(),
  });
}

export function trackPageview(path: string, search?: string): void {
  if (!ph) return;
  ph.capture("$pageview", {
    $current_url: typeof window !== "undefined" ? window.location.href : path,
    path,
    search,
  });
}

export function identifyUser(
  userId: string,
  traits: { email?: string | null; plan?: string | null; signupDate?: string }
): void {
  if (!ph) return;
  ph.identify(
    userId,
    {
      email: traits.email ?? undefined,
      plan: traits.plan ?? undefined,
      signup_date: traits.signupDate,
    },
    // First touch lands on the person once, never overwritten by later visits.
    firstTouch ?? undefined
  );
}

export function resetAnalytics(): void {
  if (!ph) return;
  ph.reset();
}
