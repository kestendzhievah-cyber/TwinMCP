import { describe, it, expect, beforeEach, vi } from "vitest";

// notifyCreditExhausted runs fire-and-forget from the MCP proxy's 402 path
// (contract W2). The daily-quota email is gone: an empty wallet triggers the
// wallet's zero-balance notification (lib/wallet/notify.ts, deduped there),
// the `quota.reached` webhook and a `credit_exhausted` event — once per user
// per UTC day per process — and nothing here may throw.

const mocks = vi.hoisted(() => ({
  notifyWalletState: vi.fn<(...args: unknown[]) => Promise<void>>(),
  emitWebhookEvent: vi.fn(),
  trackServer: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/wallet/notify", () => ({ notifyWalletState: mocks.notifyWalletState }));
vi.mock("@/lib/webhooks/emit", () => ({ emitWebhookEvent: mocks.emitWebhookEvent }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: mocks.trackServer }));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import {
  emailNudgesEnabled,
  isDeliverableEmail,
  notifyCreditExhausted,
  resetCreditNudgeClaims,
} from "@/lib/billing/quota-nudge";

const USER = "user_1";
const DAY_MS = 86_400_000;
const NOON = Date.UTC(2026, 9, 29, 12);

beforeEach(() => {
  vi.clearAllMocks();
  resetCreditNudgeClaims();
  mocks.notifyWalletState.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("notifyCreditExhausted", () => {
  it("sends the zero-balance notification, the webhook and the event", async () => {
    await notifyCreditExhausted(USER, "free", NOON);
    expect(mocks.notifyWalletState).toHaveBeenCalledWith(USER, "zero_balance", {
      source: "proxy_402",
    });
    expect(mocks.emitWebhookEvent).toHaveBeenCalledWith(USER, "quota.reached", {
      reason: "credit_exhausted",
      plan: "free",
      topupUrl: "https://twinmcp.fr/dashboard/billing",
    });
    expect(mocks.trackServer).toHaveBeenCalledWith({
      event: "credit_exhausted",
      distinctId: USER,
      properties: { plan: "free" },
    });
  });

  it("applies to funded accounts too (an empty wallet is an empty wallet)", async () => {
    await notifyCreditExhausted(USER, "pro", NOON);
    expect(mocks.notifyWalletState).toHaveBeenCalledTimes(1);
  });

  it("at most once per user per UTC day in a tool loop", async () => {
    for (let i = 0; i < 50; i++) await notifyCreditExhausted(USER, "free", NOON + i);
    expect(mocks.notifyWalletState).toHaveBeenCalledTimes(1);
    expect(mocks.emitWebhookEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackServer).toHaveBeenCalledTimes(1);

    await notifyCreditExhausted("other_user", "free", NOON);
    expect(mocks.notifyWalletState).toHaveBeenCalledTimes(2);

    await notifyCreditExhausted(USER, "free", NOON + DAY_MS);
    expect(mocks.notifyWalletState).toHaveBeenCalledTimes(3);
  });

  it("a failed notification releases the claim so a later refusal retries", async () => {
    mocks.notifyWalletState.mockRejectedValueOnce(new Error("resend down"));
    await expect(notifyCreditExhausted(USER, "free", NOON)).resolves.toBeUndefined();
    expect(mocks.captureException).toHaveBeenCalled();
    await notifyCreditExhausted(USER, "free", NOON + 1);
    expect(mocks.notifyWalletState).toHaveBeenCalledTimes(2);
  });

  it("never throws, whatever fails", async () => {
    mocks.emitWebhookEvent.mockImplementationOnce(() => {
      throw new Error("webhook");
    });
    mocks.trackServer.mockImplementationOnce(() => {
      throw new Error("posthog");
    });
    await expect(notifyCreditExhausted(USER, "free", NOON)).resolves.toBeUndefined();
    expect(mocks.notifyWalletState).toHaveBeenCalledTimes(1);
  });

  it("ignores an empty user id", async () => {
    await notifyCreditExhausted("", "free", NOON);
    expect(mocks.notifyWalletState).not.toHaveBeenCalled();
  });
});

describe("emailNudgesEnabled (re-exported for the preferences route)", () => {
  it("defaults to on, only an explicit false opts out", () => {
    expect(emailNudgesEnabled(undefined)).toBe(true);
    expect(emailNudgesEnabled(null)).toBe(true);
    expect(emailNudgesEnabled({})).toBe(true);
    expect(emailNudgesEnabled({ emailNudges: true })).toBe(true);
    expect(emailNudgesEnabled({ emailNudges: false })).toBe(false);
    expect(emailNudgesEnabled({ emailNudges: "false" })).toBe(true);
  });
});

describe("isDeliverableEmail", () => {
  it("rejects placeholders and empties", () => {
    expect(isDeliverableEmail("dev@example.com")).toBe(true);
    expect(isDeliverableEmail("x@placeholder.twinmcp.fr")).toBe(false);
    expect(isDeliverableEmail("")).toBe(false);
    expect(isDeliverableEmail(null)).toBe(false);
  });
});
