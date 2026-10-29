import { describe, it, expect, beforeAll, vi } from "vitest";

// Dashboard write endpoints (API-key create/rotate, billing) call
// checkAuthWriteLimit first. When the Upstash Redis REST host is unreachable —
// e.g. "fetch failed: getaddrinfo ENOTFOUND <db>.upstash.io" after the database
// was deleted or renamed — `.limit()` rejects. That MUST fail OPEN (ok:true),
// never throw, or every key creation 500s (seen in production, Oct 2026).
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = () => ({});
    static fixedWindow = () => ({});
    async limit() {
      throw new TypeError("fetch failed");
    }
  }
  return { Ratelimit };
});

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("checkAuthWriteLimit — fail-open when Redis is unreachable", () => {
  let checkAuthWriteLimit: (userId: string, action: string) => Promise<{ ok: boolean }>;

  beforeAll(async () => {
    // Configured (so the limiters are built) but the network call fails.
    process.env.UPSTASH_REDIS_REST_URL = "https://does-not-exist.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    ({ checkAuthWriteLimit } = await import("../lib/auth/rate-limit"));
  });

  it("returns ok:true instead of throwing on a network error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await checkAuthWriteLimit("user_test", "key_create");
    expect(res.ok).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports the outage to Sentry", async () => {
    const Sentry = await import("@sentry/nextjs");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await checkAuthWriteLimit("user_test", "key_rotate");
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
