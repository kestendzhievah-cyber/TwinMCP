import { describe, it, expect } from "vitest";
import {
  DEFAULT_RETURN_TO,
  checkoutStartPath,
  normalizeCadence,
  normalizePromo,
  needsOnboarding,
  onboardingGateApplies,
  postAuthRedirect,
  proIntentQuery,
  readFreeIntent,
  readProIntent,
  safeReturnTo,
  type PostAuthState,
} from "@/lib/auth/return-to";

describe("safeReturnTo — never leaves the site", () => {
  it.each([
    ["//evil.tld", "protocol-relative"],
    ["/\\evil.tld", "backslash host"],
    ["/foo\\bar", "any backslash"],
    ["https://evil.tld/x", "absolute https"],
    ["http://evil.tld", "absolute http"],
    ["javascript:alert(1)", "javascript: URL"],
    ["JaVaScRiPt:alert(1)", "javascript: URL, mixed case"],
    ["data:text/html,<script>1</script>", "data: URL"],
    ["dashboard", "relative path"],
    ["/dash\nboard", "newline"],
    ["/dash\tboard", "tab"],
    ["/x\u0000", "NUL"],
    ["/x\u007f", "DEL"],
  ])("rejects %j (%s)", (raw) => {
    expect(safeReturnTo(raw)).toBe(DEFAULT_RETURN_TO);
  });

  it("falls back on empty input", () => {
    expect(safeReturnTo(null)).toBe("/dashboard");
    expect(safeReturnTo(undefined)).toBe("/dashboard");
    expect(safeReturnTo("")).toBe("/dashboard");
  });

  it("keeps a same-site path with its query and hash", () => {
    expect(safeReturnTo("/dashboard/billing?plan=pro&cadence=yearly")).toBe(
      "/dashboard/billing?plan=pro&cadence=yearly"
    );
    expect(safeReturnTo("/docs#install")).toBe("/docs#install");
    expect(safeReturnTo("/reset-password")).toBe("/reset-password");
  });
});

describe("readProIntent / normalizers", () => {
  const params = (q: string) => new URLSearchParams(q);

  it("reads plan=pro with its cadence", () => {
    expect(readProIntent(params("plan=pro&cadence=yearly"))).toEqual({ cadence: "yearly" });
    expect(readProIntent(params("plan=pro"))).toEqual({ cadence: "monthly" });
  });

  it("maps the retired plan=team to a Pro intent", () => {
    expect(readProIntent(params("plan=team&cadence=annual"))).toEqual({ cadence: "yearly" });
  });

  it("is no paid intent for plan=free, an unknown plan or no plan", () => {
    expect(readProIntent(params("plan=free"))).toBeNull();
    expect(readProIntent(params("plan=enterprise"))).toBeNull();
    expect(readProIntent(params(""))).toBeNull();
  });

  it("normalizes cadence: yearly/annual → yearly, anything else → monthly", () => {
    expect(normalizeCadence("yearly")).toBe("yearly");
    expect(normalizeCadence("annual")).toBe("yearly");
    expect(normalizeCadence("weekly")).toBe("monthly");
    expect(normalizeCadence(null)).toBe("monthly");
  });

  it("accepts a creator slug or a Stripe promo id, drops anything else", () => {
    expect(normalizePromo("youtuber-42")).toBe("youtuber-42");
    expect(normalizePromo("promo_AbC123")).toBe("promo_AbC123");
    expect(normalizePromo("Uppercase")).toBeUndefined();
    expect(normalizePromo("promo_bad-chars!")).toBeUndefined();
    expect(normalizePromo("a".repeat(65))).toBeUndefined();
    expect(normalizePromo("x y")).toBeUndefined();
    expect(normalizePromo("")).toBeUndefined();
    expect(normalizePromo(null)).toBeUndefined();
  });

  it("keeps a valid promo in the intent and drops an invalid one", () => {
    expect(readProIntent(params("plan=pro&promo=promo_X1"))).toEqual({
      cadence: "monthly",
      promo: "promo_X1",
    });
    expect(readProIntent(params("plan=pro&promo=<script>"))).toEqual({ cadence: "monthly" });
  });

  it("builds the intent query and the checkout/start path", () => {
    expect(proIntentQuery({ cadence: "yearly", promo: "creator" })).toBe(
      "plan=pro&cadence=yearly&promo=creator"
    );
    expect(checkoutStartPath({ cadence: "monthly" })).toBe(
      "/api/v2/billing/checkout/start?plan=pro&cadence=monthly&from=signup"
    );
    expect(checkoutStartPath({ cadence: "yearly" }, "billing")).toBe(
      "/api/v2/billing/checkout/start?plan=pro&cadence=yearly&from=billing"
    );
  });
});

describe("postAuthRedirect", () => {
  const state = (over: Partial<PostAuthState> = {}): PostAuthState => ({
    firstSession: true,
    onboardingCompleted: false,
    subscribed: false,
    ...over,
  });

  it("sends a Pro intent with no subscription to Stripe Checkout", () => {
    expect(
      postAuthRedirect({ returnTo: "/dashboard", intent: { cadence: "yearly" }, state: state() })
    ).toBe("/api/v2/billing/checkout/start?plan=pro&cadence=yearly&from=signup");
  });

  it("never opens a second checkout for an already subscribed account", () => {
    expect(
      postAuthRedirect({
        returnTo: "/dashboard",
        intent: { cadence: "monthly" },
        state: state({ subscribed: true, onboardingCompleted: true }),
      })
    ).toBe("/dashboard");
    expect(
      postAuthRedirect({
        returnTo: "/dashboard",
        intent: { cadence: "monthly" },
        state: state({ subscribed: true, onboardingCompleted: false }),
      })
    ).toBe("/onboarding");
  });

  it("sends an unfinished onboarding on the default landing to the wizard", () => {
    expect(postAuthRedirect({ returnTo: "/dashboard", intent: null, state: state() })).toBe(
      "/onboarding"
    );
  });

  it("keeps the default landing when onboarding is done or unknown (lookup failed)", () => {
    expect(
      postAuthRedirect({
        returnTo: "/dashboard",
        intent: null,
        state: state({ onboardingCompleted: true }),
      })
    ).toBe("/dashboard");
    expect(
      postAuthRedirect({
        returnTo: "/dashboard",
        intent: null,
        state: state({ onboardingCompleted: null }),
      })
    ).toBe("/dashboard");
  });

  it("honours an explicit returnTo over the wizard", () => {
    expect(postAuthRedirect({ returnTo: "/dashboard/servers", intent: null, state: state() })).toBe(
      "/dashboard/servers"
    );
  });
});

describe("postAuthRedirect — plan=free survives to the wizard", () => {
  const state = (over: Partial<PostAuthState> = {}): PostAuthState => ({
    firstSession: true,
    onboardingCompleted: false,
    subscribed: false,
    ...over,
  });

  it("reads plan=free only", () => {
    expect(readFreeIntent(new URLSearchParams("plan=free"))).toBe(true);
    expect(readFreeIntent(new URLSearchParams("plan=pro"))).toBe(false);
    expect(readFreeIntent(new URLSearchParams(""))).toBe(false);
  });

  it("opens the wizard with ?plan=free", () => {
    expect(
      postAuthRedirect({ returnTo: "/dashboard", intent: null, state: state(), freeIntent: true })
    ).toBe("/onboarding?plan=free");
  });

  it("keeps the checkout flow for plan=pro", () => {
    expect(
      postAuthRedirect({
        returnTo: "/dashboard",
        intent: { cadence: "monthly" },
        state: state(),
        freeIntent: true,
      })
    ).toBe("/api/v2/billing/checkout/start?plan=pro&cadence=monthly&from=signup");
  });

  it("does not add plan=free once onboarding is done or to an explicit returnTo", () => {
    expect(
      postAuthRedirect({
        returnTo: "/dashboard",
        intent: null,
        state: state({ onboardingCompleted: true }),
        freeIntent: true,
      })
    ).toBe("/dashboard");
    expect(
      postAuthRedirect({
        returnTo: "/dashboard/servers",
        intent: null,
        state: state(),
        freeIntent: true,
      })
    ).toBe("/dashboard/servers");
  });
});

describe("onboarding gate", () => {
  const base = {
    isAdmin: false,
    onboardingCompleted: false as boolean | null,
    serverCount: 0 as number | null,
  };

  it("gates a new account with no server and no finished (or skipped) onboarding", () => {
    expect(needsOnboarding(base)).toBe(true);
  });

  it("never gates admins, teamspace members, a server owner or a finished / skipped onboarding", () => {
    expect(needsOnboarding({ ...base, isAdmin: true })).toBe(false);
    expect(needsOnboarding({ ...base, teamMember: true })).toBe(false);
    expect(needsOnboarding({ ...base, serverCount: 1 })).toBe(false);
    expect(needsOnboarding({ ...base, onboardingCompleted: true })).toBe(false);
  });

  it("fails open when a lookup failed", () => {
    expect(needsOnboarding({ ...base, onboardingCompleted: null })).toBe(false);
    expect(needsOnboarding({ ...base, serverCount: null })).toBe(false);
  });

  it("applies to dashboard pages but never to onboarding, billing or settings", () => {
    expect(onboardingGateApplies("/dashboard")).toBe(true);
    expect(onboardingGateApplies("/dashboard/servers")).toBe(true);
    expect(onboardingGateApplies("/onboarding")).toBe(false);
    expect(onboardingGateApplies("/dashboard/billing")).toBe(false);
    expect(onboardingGateApplies("/dashboard/billing/anything")).toBe(false);
    expect(onboardingGateApplies("/dashboard/settings/webhooks")).toBe(false);
    expect(onboardingGateApplies(null)).toBe(false);
  });

  it("matches whole path segments only", () => {
    expect(onboardingGateApplies("/dashboard/billingx")).toBe(true);
  });
});
