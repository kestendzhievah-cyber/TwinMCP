import { describe, it, expect, beforeAll } from "vitest";

// The context / libs endpoints call checkAbuseLimit on every request.
// If Upstash Redis isn't configured (or is unreachable), it MUST fail OPEN
// (return ok:true) rather than throw — otherwise every MCP call 500s. Guards the
// regression that a missing Redis env would take the whole product down.
describe("checkAbuseLimit — fail-open without Redis", () => {
  let checkAbuseLimit: (userId: string) => Promise<{ ok: boolean }>;

  beforeAll(async () => {
    // Ensure Redis is NOT configured so getRedis() throws → fail-open path.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    ({ checkAbuseLimit } = await import("../lib/rate-limit"));
    // The dynamic import pulls @upstash/ratelimit + @sentry/nextjs; a cold
    // collect under a full-suite run can take well over the 10 s default.
  }, 30_000);

  it("returns ok:true (does not throw) when Redis is unavailable", async () => {
    const res = await checkAbuseLimit("user_test");
    expect(res.ok).toBe(true);
  });
});
