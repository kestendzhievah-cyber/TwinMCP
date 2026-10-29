import { describe, it, expect } from "vitest";
import {
  buildPayload,
  describeDeliveryError,
  isSuccessStatus,
  MAX_ATTEMPTS,
  newEventId,
  newMessageId,
  nextRetryDelaySec,
  RETRY_DELAYS_SEC,
  shouldDisableEndpoint,
  WEBHOOK_DISABLE_AFTER_FAILURES,
} from "./policy";
import { normalizeEvents, SUBSCRIBABLE_EVENTS } from "./events";

describe("retry backoff schedule", () => {
  it("retries after 30 s, 2 min, 10 min, 1 h, 6 h, then stops", () => {
    expect([1, 2, 3, 4, 5].map((n) => nextRetryDelaySec(n))).toEqual([30, 120, 600, 3_600, 21_600]);
    expect(nextRetryDelaySec(6)).toBeNull();
    expect(MAX_ATTEMPTS).toBe(6);
  });

  it("is strictly increasing", () => {
    for (let i = 1; i < RETRY_DELAYS_SEC.length; i++) {
      expect(RETRY_DELAYS_SEC[i]!).toBeGreaterThan(RETRY_DELAYS_SEC[i - 1]!);
    }
  });

  it("adds at most +10 % jitter", () => {
    expect(nextRetryDelaySec(1, 0.5)).toBe(32); // 30 * 1.05 → 31.5 → 32
    expect(nextRetryDelaySec(5, 0.999)).toBeLessThanOrEqual(Math.round(21_600 * 1.1));
    expect(nextRetryDelaySec(5, 5)).toBeLessThanOrEqual(Math.round(21_600 * 1.1));
    expect(nextRetryDelaySec(2, -1)).toBe(120);
  });

  it("returns null for nonsense attempt counts", () => {
    expect(nextRetryDelaySec(0)).toBeNull();
    expect(nextRetryDelaySec(-1)).toBeNull();
    expect(nextRetryDelaySec(1.5)).toBeNull();
  });
});

describe("auto-disable", () => {
  it("disables after 20 consecutive failed deliveries", () => {
    expect(WEBHOOK_DISABLE_AFTER_FAILURES).toBe(20);
    expect(shouldDisableEndpoint(19)).toBe(false);
    expect(shouldDisableEndpoint(20)).toBe(true);
    expect(shouldDisableEndpoint(21)).toBe(true);
  });
});

describe("delivery helpers", () => {
  it("treats only 2xx as success (redirects are failures)", () => {
    expect(isSuccessStatus(200)).toBe(true);
    expect(isSuccessStatus(204)).toBe(true);
    expect(isSuccessStatus(299)).toBe(true);
    expect(isSuccessStatus(301)).toBe(false);
    expect(isSuccessStatus(404)).toBe(false);
    expect(isSuccessStatus(500)).toBe(false);
    expect(isSuccessStatus(null)).toBe(false);
  });

  it("mints prefixed random ids", () => {
    expect(newMessageId()).toMatch(/^msg_[0-9a-f]{32}$/);
    expect(newEventId()).toMatch(/^evt_[0-9a-f]{32}$/);
    expect(newMessageId()).not.toBe(newMessageId());
  });

  it("builds the Standard Webhooks payload shape", () => {
    const now = new Date("2026-10-28T12:00:00.000Z");
    expect(buildPayload("evt_1", "mcp.installed", { mcpSlug: "github" }, now)).toEqual({
      id: "evt_1",
      type: "mcp.installed",
      timestamp: "2026-10-28T12:00:00.000Z",
      data: { mcpSlug: "github" },
    });
  });

  it("describes transport errors briefly", () => {
    expect(describeDeliveryError({ name: "SsrfBlockedError", message: "x" })).toMatch(/private/);
    expect(describeDeliveryError({ name: "TimeoutError" })).toMatch(/Timed out/);
    expect(describeDeliveryError({ code: "ENOTFOUND" })).toBe("DNS lookup failed");
    expect(describeDeliveryError({ code: "ECONNREFUSED" })).toBe("Connection refused");
    expect(describeDeliveryError({ code: "CERT_HAS_EXPIRED" })).toBe("TLS certificate error");
    // Never the raw error text (it can describe the network path).
    expect(describeDeliveryError(new Error("connect to 10.0.0.5:5432"))).toBe("Delivery failed");
    expect(describeDeliveryError(null)).toBe("Delivery failed");
  });
});

describe("event catalogue", () => {
  it("never offers 'test' as a subscription", () => {
    expect(SUBSCRIBABLE_EVENTS).not.toContain("test");
    expect(SUBSCRIBABLE_EVENTS).toEqual([
      "server.status_changed",
      "server.health_failed",
      "quota.reached",
      "mcp.installed",
    ]);
  });

  it("normalizes a subscription list", () => {
    expect(
      normalizeEvents(["mcp.installed", "test", "bogus", "quota.reached", "mcp.installed"])
    ).toEqual(["quota.reached", "mcp.installed"]);
  });
});
