import { describe, it, expect } from "vitest";
import { jsonError, unauthorized, rateLimited, badRequest, notFound } from "@/lib/errors";
import { getDailyLimit } from "@/lib/rate-limit";

const HOUR_MS = 3_600_000;

describe("Error responses", () => {
  it("jsonError returns correct status and message", () => {
    const res = jsonError(418, "teapot");
    expect(res.status).toBe(418);
  });

  it("unauthorized returns 401", () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
  });

  it("badRequest returns 400", () => {
    const res = badRequest("oops");
    expect(res.status).toBe(400);
  });

  it("notFound returns 404", () => {
    const res = notFound();
    expect(res.status).toBe(404);
  });
});

describe("rateLimited — generic (no window details)", () => {
  it("returns 429 with the upgrade link for keyed users and no rate-limit headers", async () => {
    const res = rateLimited(true);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("https://twinmcp.fr/dashboard/billing");
    expect(res.headers.get("Retry-After")).toBeNull();
    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
  });

  it("returns 429 with the create-key link for anonymous callers", async () => {
    const res = rateLimited(false);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Create a free API key");
    expect(body.message).toContain("https://twinmcp.fr/dashboard");
  });
});

describe("rateLimited — upgrade-aware (with window details)", () => {
  const freeLimit = getDailyLimit("free");
  const proLimit = getDailyLimit("pro");
  const proLimitText = proLimit.toLocaleString("en-US");

  it("Free plan: names the quota, the reset, the Pro limit and the free month", async () => {
    const reset = Date.now() + 2 * HOUR_MS;
    const res = rateLimited(true, {
      plan: "free",
      limit: freeLimit,
      remaining: 0,
      reset,
      trialEligible: true,
    });
    expect(res.status).toBe(429);

    const body = (await res.json()) as {
      message: string;
      limit: number;
      remaining: number;
      resetsAt: string;
      plan: string;
      upgradeUrl?: string;
    };
    expect(body.message).toContain(`Daily limit reached: ${freeLimit} tool calls per day`);
    expect(body.message).toContain("on the Free plan");
    expect(body.message).toMatch(/Resets at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\./);
    expect(body.message).toContain(`Pro raises it to ${proLimitText} per day`);
    expect(body.message).toContain("your first month is free");
    expect(body.message).toContain("https://twinmcp.fr/dashboard/billing");
    expect(body.message).not.toContain("hello@twinmcp.fr");

    expect(body.limit).toBe(freeLimit);
    expect(body.remaining).toBe(0);
    expect(body.plan).toBe("free");
    expect(body.upgradeUrl).toBe("https://twinmcp.fr/dashboard/billing");
    expect(new Date(body.resetsAt).getTime()).toBe(reset);
  });

  it("Free plan with trial eligibility unknown: no free-month promise", async () => {
    const res = rateLimited(true, {
      plan: "free",
      limit: freeLimit,
      remaining: 0,
      reset: Date.now() + HOUR_MS,
    });
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain(`Pro raises it to ${proLimitText} per day`);
    expect(body.message).not.toContain("first month");
    expect(body.message).toContain("https://twinmcp.fr/dashboard/billing");
  });

  it("Free plan without the trial: no free-month promise", async () => {
    const res = rateLimited(true, {
      plan: "free",
      limit: freeLimit,
      remaining: 0,
      reset: Date.now() + HOUR_MS,
      trialEligible: false,
    });
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain(`Pro raises it to ${proLimitText} per day`);
    expect(body.message).not.toContain("first month is free");
    expect(body.message).toContain("https://twinmcp.fr/dashboard/billing");
  });

  it("Pro plan: no upsell, points at support instead", async () => {
    const res = rateLimited(true, {
      plan: "pro",
      limit: proLimit,
      remaining: 0,
      reset: Date.now() + HOUR_MS,
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { message: string; upgradeUrl?: string };
    expect(body.message).toContain(`Daily limit reached: ${proLimitText} tool calls per day`);
    expect(body.message).toContain("on the Pro plan");
    expect(body.message).toContain("Contact hello@twinmcp.fr if you need more");
    expect(body.message).not.toContain("first month");
    expect(body.message).not.toContain("Pro raises");
    expect(body.upgradeUrl).toBeUndefined();
  });

  it("Team plan (grandfathered) behaves like Pro", async () => {
    const res = rateLimited(true, {
      plan: "team",
      limit: getDailyLimit("team"),
      remaining: 0,
      reset: Date.now() + HOUR_MS,
    });
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("on the Team plan");
    expect(body.message).toContain("Contact hello@twinmcp.fr");
  });

  it("sets Retry-After and X-RateLimit-* headers from the window", () => {
    const now = Date.now();
    const reset = now + 90 * 60 * 1000; // 90 minutes
    const res = rateLimited(true, { plan: "free", limit: freeLimit, remaining: 0, reset });

    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(89 * 60);
    expect(retryAfter).toBeLessThanOrEqual(90 * 60 + 1);
    expect(res.headers.get("X-RateLimit-Limit")).toBe(String(freeLimit));
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(res.headers.get("X-RateLimit-Reset"))).toBe(Math.ceil(reset / 1000));
  });

  it("clamps Retry-After to at least 1 second and never reports negative remaining", () => {
    const res = rateLimited(true, {
      plan: "free",
      limit: freeLimit,
      remaining: -3,
      reset: Date.now() - 5000, // already past: falls back to the next UTC midnight
    });
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    const resetSec = Number(res.headers.get("X-RateLimit-Reset"));
    expect(resetSec * 1000).toBeGreaterThan(Date.now());
  });

  it("anonymous callers with details get headers and the create-key hint", async () => {
    const res = rateLimited(false, { limit: 10, remaining: 0, reset: Date.now() + HOUR_MS });
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Daily limit reached: 10 requests per day");
    expect(body.message).toContain("Create a free API key");
  });
});
