import { describe, it, expect } from "vitest";
import {
  CHECKOUT_FROMS,
  attributionMetadata,
  checkoutReturnUrls,
  isCheckoutErrorReason,
  isCheckoutFrom,
} from "@/lib/billing/checkout-helpers";

const ORIGIN = "https://twinmcp.fr";

describe("checkoutReturnUrls (contract C3)", () => {
  it.each(["onboarding", "signup"] as const)("from=%s returns to onboarding", (from) => {
    const urls = checkoutReturnUrls(ORIGIN, from);
    expect(urls.success_url).toBe(
      "https://twinmcp.fr/onboarding?status=success&step=1&session_id={CHECKOUT_SESSION_ID}"
    );
    expect(urls.cancel_url).toBe("https://twinmcp.fr/onboarding?checkout=canceled");
  });

  it.each(["billing", "pricing"] as const)("from=%s returns to Billing", (from) => {
    const urls = checkoutReturnUrls(ORIGIN, from);
    expect(urls.success_url).toBe(
      "https://twinmcp.fr/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}"
    );
    expect(urls.cancel_url).toBe("https://twinmcp.fr/dashboard/billing?status=canceled");
  });

  it("keeps the session_id placeholder on every success URL (Ads conversion)", () => {
    for (const from of CHECKOUT_FROMS) {
      expect(checkoutReturnUrls(ORIGIN, from).success_url).toContain(
        "session_id={CHECKOUT_SESSION_ID}"
      );
    }
  });

  it("strips a trailing slash from the origin", () => {
    const urls = checkoutReturnUrls("https://twinmcp.fr/", "billing");
    expect(urls.success_url.startsWith("https://twinmcp.fr/dashboard/")).toBe(true);
    expect(urls.cancel_url).not.toContain("fr//");
  });
});

describe("attributionMetadata (Stripe metadata whitelist)", () => {
  it("keeps the known keys", () => {
    expect(
      attributionMetadata({
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "smithery_migration",
        gclid: "abc",
        ref: "blog",
        landing_path: "/fr",
        locale: "fr",
        referrer_host: "google.com",
        first_seen_at: "2026-10-27T10:00:00.000Z",
      })
    ).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "smithery_migration",
      gclid: "abc",
      ref: "blog",
      landing_path: "/fr",
      locale: "fr",
      referrer_host: "google.com",
      first_seen_at: "2026-10-27T10:00:00.000Z",
    });
  });

  it("drops unknown keys", () => {
    expect(attributionMetadata({ utm_source: "x", userId: "u1", plan: "pro", evil: "1" })).toEqual({
      utm_source: "x",
    });
  });

  it("drops non-string and blank values, trims the rest", () => {
    expect(
      attributionMetadata({
        utm_source: 42,
        utm_medium: null,
        utm_campaign: { nested: true },
        utm_term: ["a"],
        utm_content: "   ",
        ref: "  partner  ",
      })
    ).toEqual({ ref: "partner" });
  });

  it("caps every value at 500 characters", () => {
    const out = attributionMetadata({ utm_campaign: "c".repeat(800) });
    expect(out.utm_campaign).toHaveLength(500);
  });

  it("returns an empty object for null or a non-object", () => {
    expect(attributionMetadata(null)).toEqual({});
    expect(attributionMetadata(undefined)).toEqual({});
  });
});

describe("guards", () => {
  it("isCheckoutFrom accepts the four surfaces only", () => {
    for (const from of ["billing", "onboarding", "pricing", "signup"]) {
      expect(isCheckoutFrom(from)).toBe(true);
    }
    expect(isCheckoutFrom("plans")).toBe(false);
    expect(isCheckoutFrom(null)).toBe(false);
  });

  it("isCheckoutErrorReason accepts the fixed codes only", () => {
    expect(isCheckoutErrorReason("price")).toBe(true);
    expect(isCheckoutErrorReason("stripe")).toBe(true);
    expect(isCheckoutErrorReason("unknown")).toBe(true);
    expect(isCheckoutErrorReason("Your account is suspended")).toBe(false);
    expect(isCheckoutErrorReason(null)).toBe(false);
  });
});
