// The Stripe webhook events TwinMCP handles, and the pure helpers that
// scripts/configure-stripe-webhook.ts uses to bring the live endpoint's
// enabled_events in line with them.
//
// HANDLED_STRIPE_EVENTS mirrors the `case` labels of handleStripeEvent() in
// src/app/api/webhooks/stripe/route.ts. A test reads that route's source and
// fails when the two drift apart, so a new `case` cannot ship without the
// endpoint being told to send it.
//
// No imports: this file is loaded by a CLI script and by the route alike.

export const HANDLED_STRIPE_EVENTS = [
  // Wallet top-ups (Checkout, mode payment) and saved-card setup.
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  // Off-session auto-recharges.
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  // Refunds and disputes claw the credit back / restore it.
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  // Legacy subscriptions, mirrored until scripts/migrate-pro-to-wallet.ts ran.
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export type HandledStripeEvent = (typeof HANDLED_STRIPE_EVENTS)[number];

/** The production webhook URL the configure script targets by default. */
export const DEFAULT_STRIPE_WEBHOOK_URL = "https://twinmcp.fr/api/webhooks/stripe";

/** Hosts that receive real money: a test-mode key must not configure them. */
export const LIVE_WEBHOOK_HOSTS = ["twinmcp.fr"] as const;

/**
 * Handled events the endpoint does not send yet, in HANDLED order. An endpoint
 * enabled for every event ("*") misses nothing.
 */
export function missingStripeEvents(
  enabled: readonly string[],
  handled: readonly string[] = HANDLED_STRIPE_EVENTS
): string[] {
  if (enabled.includes("*")) return [];
  const have = new Set(enabled);
  const out: string[] = [];
  for (const e of handled) if (!have.has(e) && !out.includes(e)) out.push(e);
  return out;
}

/**
 * The enabled_events to write: every event already enabled (kept, in its order,
 * even the ones TwinMCP ignores) followed by the missing handled ones. It
 * never removes anything; "*" stays "*".
 */
export function mergedStripeEvents(
  enabled: readonly string[],
  handled: readonly string[] = HANDLED_STRIPE_EVENTS
): string[] {
  if (enabled.includes("*")) return ["*"];
  const kept: string[] = [];
  for (const e of enabled) if (!kept.includes(e)) kept.push(e);
  return [...kept, ...missingStripeEvents(kept, handled)];
}

/** Events the endpoint sends that no handler reads (harmless, reported only). */
export function unhandledStripeEvents(
  enabled: readonly string[],
  handled: readonly string[] = HANDLED_STRIPE_EVENTS
): string[] {
  const known = new Set(handled);
  return enabled.filter((e) => e !== "*" && !known.has(e));
}

export type StripeKeyMode = "live" | "test" | "unknown";

/** Live or test, from the secret / restricted key prefix. */
export function stripeKeyMode(key: string | undefined | null): StripeKeyMode {
  const k = (key ?? "").trim();
  if (/^(sk|rk)_live_/.test(k)) return "live";
  if (/^(sk|rk)_test_/.test(k)) return "test";
  return "unknown";
}

/** Whether a webhook URL points at a production host (twinmcp.fr or a subdomain). */
export function isLiveWebhookUrl(
  url: string,
  liveHosts: readonly string[] = LIVE_WEBHOOK_HOSTS
): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return liveHosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Same endpoint: scheme + host compared case-insensitively, trailing slashes ignored. */
export function sameWebhookUrl(a: string, b: string): boolean {
  const norm = (u: string): string => {
    try {
      const p = new URL(u);
      return `${p.protocol}//${p.host.toLowerCase()}${p.pathname.replace(/\/+$/, "")}${p.search}`;
    } catch {
      return u.trim().replace(/\/+$/, "");
    }
  };
  return norm(a) === norm(b);
}

export type WebhookGuard = { ok: true; warning?: string } | { ok: false; reason: string };

/**
 * Refuses a test-mode (or unrecognised) key against a production URL unless
 * forced: test events would hit the live server, fail its signature check and
 * be retried for days. A live key against a non-production URL only warns.
 */
export function checkWebhookTarget(input: {
  key: string | undefined | null;
  url: string;
  force?: boolean;
}): WebhookGuard {
  const mode = stripeKeyMode(input.key);
  if (!input.key || !input.key.trim()) {
    return { ok: false, reason: "STRIPE_SECRET_KEY is not set" };
  }
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { ok: false, reason: `not a valid URL: ${input.url}` };
  }
  if (parsed.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(parsed.hostname)) {
    return { ok: false, reason: `Stripe only delivers to https URLs: ${input.url}` };
  }
  const live = isLiveWebhookUrl(input.url);
  if (live && mode !== "live") {
    if (input.force) {
      return {
        ok: true,
        warning: `--force: a ${mode}-mode key is configuring the production URL ${input.url}`,
      };
    }
    return {
      ok: false,
      reason:
        mode === "test"
          ? `refusing: a TEST-mode key (sk_test_…) against the production URL ${input.url}. Use the live key, or pass --force.`
          : `refusing: the key is neither sk_live_ nor sk_test_ and the URL is production (${input.url}). Pass --force to go on.`,
    };
  }
  if (!live && mode === "live") {
    return {
      ok: true,
      warning: `a LIVE key is configuring a non-production URL (${input.url})`,
    };
  }
  return { ok: true };
}

export interface ConfigureArgs {
  url: string;
  apply: boolean;
  force: boolean;
}

/** `[url] [--apply] [--force]` (also `--url <u>` / `--url=<u>`). */
export function parseConfigureArgs(argv: readonly string[]): ConfigureArgs {
  const out: ConfigureArgs = { url: DEFAULT_STRIPE_WEBHOOK_URL, apply: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--apply") out.apply = true;
    else if (a === "--force") out.force = true;
    else if (a === "--url") out.url = argv[++i] ?? out.url;
    else if (a.startsWith("--url=")) out.url = a.slice("--url=".length);
    else if (!a.startsWith("--")) out.url = a;
  }
  return out;
}
