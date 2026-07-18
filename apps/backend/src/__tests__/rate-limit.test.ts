import { describe, it, expect, beforeAll } from "vitest";

// The MCP proxy / context / libs endpoints call checkRateLimit on every request.
// If Upstash Redis isn't configured (or is unreachable), it MUST fail OPEN
// (return ok:true) rather than throw — otherwise every MCP call 500s. Guards the
// regression that a missing Redis env would take the whole product down.
describe("checkRateLimit — fail-open without Redis", () => {
  let checkRateLimit: (userId: string, plan: "free" | "pro" | "team") => Promise<{ ok: boolean }>;

  beforeAll(async () => {
    // Ensure Redis is NOT configured so getRedis() throws → fail-open path.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    ({ checkRateLimit } = await import("../lib/rate-limit"));
  });

  it("returns ok:true (does not throw) when Redis is unavailable", async () => {
    const res = await checkRateLimit("user_test", "free");
    expect(res.ok).toBe(true);
  });

  it("stays open for every plan", async () => {
    for (const plan of ["free", "pro", "team"] as const) {
      const res = await checkRateLimit("user_test", plan);
      expect(res.ok).toBe(true);
    }
  });
});
