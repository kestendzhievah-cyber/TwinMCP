import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  HANDLED_STRIPE_EVENTS,
  DEFAULT_STRIPE_WEBHOOK_URL,
  checkWebhookTarget,
  isLiveWebhookUrl,
  mergedStripeEvents,
  missingStripeEvents,
  parseConfigureArgs,
  sameWebhookUrl,
  stripeKeyMode,
  unhandledStripeEvents,
} from "@/lib/billing/stripe-events";

// src/lib/billing/stripe-events.ts: the events the webhook handles and the
// pure logic of scripts/configure-stripe-webhook.ts.

describe("HANDLED_STRIPE_EVENTS", () => {
  it("matches the case labels of the webhook route's switch", () => {
    const src = readFileSync(resolve(__dirname, "../app/api/webhooks/stripe/route.ts"), "utf8");
    const start = src.indexOf("async function handleStripeEvent");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start);
    const cases = [...body.matchAll(/^\s*case\s+"([a-z_.]+)"\s*:/gm)].map((m) => m[1]);
    expect(cases.length).toBeGreaterThan(0);
    expect([...cases].sort()).toEqual([...HANDLED_STRIPE_EVENTS].sort());
  });

  it("has no duplicates", () => {
    expect(new Set(HANDLED_STRIPE_EVENTS).size).toBe(HANDLED_STRIPE_EVENTS.length);
  });
});

describe("missingStripeEvents", () => {
  it("lists every handled event for an empty endpoint", () => {
    expect(missingStripeEvents([])).toEqual([...HANDLED_STRIPE_EVENTS]);
  });

  it("lists only what is absent, in handled order", () => {
    expect(missingStripeEvents(["b", "x"], ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("is empty when everything is enabled, or for a wildcard endpoint", () => {
    expect(missingStripeEvents([...HANDLED_STRIPE_EVENTS])).toEqual([]);
    expect(missingStripeEvents(["*"])).toEqual([]);
  });

  it("the old subscription-era endpoint misses the wallet events", () => {
    const old = [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
      "invoice.paid",
    ];
    const missing = missingStripeEvents(old);
    expect(missing).toContain("payment_intent.succeeded");
    expect(missing).toContain("charge.refunded");
    expect(missing).not.toContain("checkout.session.completed");
    expect(missing).toHaveLength(HANDLED_STRIPE_EVENTS.length - 4);
  });
});

describe("mergedStripeEvents", () => {
  it("keeps every enabled event (even unhandled ones) and appends the missing", () => {
    expect(mergedStripeEvents(["x", "b"], ["a", "b"])).toEqual(["x", "b", "a"]);
  });

  it("never removes and dedupes", () => {
    const merged = mergedStripeEvents(["invoice.paid", "invoice.paid"]);
    expect(merged[0]).toBe("invoice.paid");
    expect(merged.filter((e) => e === "invoice.paid")).toHaveLength(1);
    for (const e of HANDLED_STRIPE_EVENTS) expect(merged).toContain(e);
  });

  it("leaves a wildcard alone", () => {
    expect(mergedStripeEvents(["*"])).toEqual(["*"]);
  });

  it("is a no-op when nothing is missing", () => {
    const all = [...HANDLED_STRIPE_EVENTS];
    expect(mergedStripeEvents(all)).toEqual(all);
  });
});

describe("unhandledStripeEvents", () => {
  it("reports enabled events no handler reads, ignoring the wildcard", () => {
    expect(unhandledStripeEvents(["*", "invoice.paid", "charge.refunded"])).toEqual([
      "invoice.paid",
    ]);
  });
});

describe("stripeKeyMode", () => {
  it("reads the key prefix", () => {
    expect(stripeKeyMode("sk_live_abc")).toBe("live");
    expect(stripeKeyMode("rk_live_abc")).toBe("live");
    expect(stripeKeyMode("sk_test_abc")).toBe("test");
    expect(stripeKeyMode("rk_test_abc")).toBe("test");
    expect(stripeKeyMode("pk_live_abc")).toBe("unknown");
    expect(stripeKeyMode("")).toBe("unknown");
    expect(stripeKeyMode(undefined)).toBe("unknown");
  });
});

describe("isLiveWebhookUrl / sameWebhookUrl", () => {
  it("treats twinmcp.fr and its subdomains as production", () => {
    expect(isLiveWebhookUrl(DEFAULT_STRIPE_WEBHOOK_URL)).toBe(true);
    expect(isLiveWebhookUrl("https://api.twinmcp.fr/api/webhooks/stripe")).toBe(true);
    expect(isLiveWebhookUrl("https://TWINMCP.FR/x")).toBe(true);
    expect(isLiveWebhookUrl("https://twinmcp.fr.evil.com/x")).toBe(false);
    expect(isLiveWebhookUrl("https://nottwinmcp.fr/x")).toBe(false);
    expect(isLiveWebhookUrl("http://localhost:3000/api/webhooks/stripe")).toBe(false);
    expect(isLiveWebhookUrl("not a url")).toBe(false);
  });

  it("compares URLs ignoring host case and trailing slashes", () => {
    expect(
      sameWebhookUrl("https://TwinMCP.fr/api/webhooks/stripe/", DEFAULT_STRIPE_WEBHOOK_URL)
    ).toBe(true);
    expect(
      sameWebhookUrl("https://twinmcp.fr/api/webhooks/other", DEFAULT_STRIPE_WEBHOOK_URL)
    ).toBe(false);
  });
});

describe("checkWebhookTarget (live/test guard)", () => {
  const live = DEFAULT_STRIPE_WEBHOOK_URL;

  it("accepts a live key against the production URL", () => {
    expect(checkWebhookTarget({ key: "sk_live_x", url: live })).toEqual({ ok: true });
  });

  it("refuses a test key against the production URL", () => {
    const r = checkWebhookTarget({ key: "sk_test_x", url: live });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/TEST-mode/);
  });

  it("lets --force through, with a warning", () => {
    const r = checkWebhookTarget({ key: "sk_test_x", url: live, force: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warning).toMatch(/--force/);
  });

  it("refuses an unrecognised key against production unless forced", () => {
    expect(checkWebhookTarget({ key: "pk_live_x", url: live }).ok).toBe(false);
    expect(checkWebhookTarget({ key: "pk_live_x", url: live, force: true }).ok).toBe(true);
  });

  it("refuses a missing key, even with --force", () => {
    expect(checkWebhookTarget({ key: undefined, url: live, force: true }).ok).toBe(false);
    expect(checkWebhookTarget({ key: "  ", url: live }).ok).toBe(false);
  });

  it("accepts a test key against a non-production URL", () => {
    expect(
      checkWebhookTarget({
        key: "sk_test_x",
        url: "https://staging.example.com/api/webhooks/stripe",
      })
    ).toEqual({ ok: true });
  });

  it("warns (does not refuse) on a live key against a non-production URL", () => {
    const r = checkWebhookTarget({ key: "sk_live_x", url: "https://staging.example.com/hook" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warning).toMatch(/LIVE key/);
  });

  it("refuses an invalid or plain-http public URL", () => {
    expect(checkWebhookTarget({ key: "sk_test_x", url: "nope" }).ok).toBe(false);
    expect(checkWebhookTarget({ key: "sk_test_x", url: "http://example.com/hook" }).ok).toBe(false);
    expect(checkWebhookTarget({ key: "sk_test_x", url: "http://localhost:3000/hook" }).ok).toBe(
      true
    );
  });
});

describe("parseConfigureArgs", () => {
  it("defaults to a dry run on the production URL", () => {
    expect(parseConfigureArgs([])).toEqual({
      url: DEFAULT_STRIPE_WEBHOOK_URL,
      apply: false,
      force: false,
    });
  });

  it("reads --apply, --force, a positional URL and --url forms", () => {
    expect(parseConfigureArgs(["--", "--apply", "https://a.test/h", "--force"])).toEqual({
      url: "https://a.test/h",
      apply: true,
      force: true,
    });
    expect(parseConfigureArgs(["--url", "https://b.test/h"]).url).toBe("https://b.test/h");
    expect(parseConfigureArgs(["--url=https://c.test/h"]).url).toBe("https://c.test/h");
  });
});
