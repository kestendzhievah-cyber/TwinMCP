// Funnel events — single source of truth for the conversion funnel.
//
// Expected funnel in PostHog:
//   landing_view → pricing_view → signup_started → signup_completed
//                → onboarding_step_completed{step:welcome|server|mcp|connect}
//                → first_server_created → first_mcp_installed → checkout_started
//
// Discriminated union ensures the call site cannot use the wrong properties
// for an event. New events MUST be added here, not inlined at the call site.

import posthog from "posthog-js";

export type FunnelEvent =
  | { name: "landing_view" }
  | { name: "pricing_view" }
  | { name: "signup_started" }
  | { name: "oauth_clicked"; properties: { provider: "github" | "google" } }
  | {
      name: "signup_completed";
      properties: { method: "password" | "magic-link" | "oauth"; via: "client" | "server" };
    }
  | {
      name: "onboarding_step_completed";
      properties: { step: "welcome" | "server" | "mcp" | "connect" };
    }
  | { name: "onboarding_skipped"; properties: { atStep: number } }
  | { name: "first_server_created"; properties: { serverId: string } }
  | { name: "first_mcp_installed"; properties: { mcpSlug: string } }
  | {
      name: "checkout_started";
      properties: {
        plan: "free" | "pro" | "team";
        cadence?: "monthly" | "annual";
      };
    };

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    // No-op when the env is unset (dev without analytics, ephemeral previews).
    return;
  }
  posthog.init(key, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function isAnalyticsReady(): boolean {
  return initialized;
}

export function track(event: FunnelEvent): void {
  if (!initialized) return;
  const properties = "properties" in event ? event.properties : undefined;
  posthog.capture(event.name, properties);
}

export function trackPageview(path: string, search?: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", {
    $current_url: typeof window !== "undefined" ? window.location.href : path,
    path,
    search,
  });
}

export function identifyUser(
  userId: string,
  traits: { email?: string | null; plan?: string | null; signupDate?: string }
): void {
  if (!initialized) return;
  posthog.identify(userId, {
    email: traits.email ?? undefined,
    plan: traits.plan ?? undefined,
    signup_date: traits.signupDate,
  });
}

export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}
