import { describe, it, expect } from "vitest";
import {
  CREDIT_DOCS_URL,
  CREDIT_EXHAUSTED_MESSAGE,
  CREDIT_TOPUP_URL,
  jsonError,
  unauthorized,
  rateLimited,
  rateLimitMessage,
  badRequest,
  notFound,
} from "@/lib/errors";

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
  it("returns 429 without any plan upsell and no rate-limit headers", async () => {
    const res = rateLimited(true);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/^Rate limited\./);
    expect(body.message).not.toMatch(/upgrade|Pro|first month/i);
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

describe("rateLimited — with window details (no daily-quota upsell any more)", () => {
  it("per-minute tool-call limiter: names the limit, the window and the reset", async () => {
    const reset = Date.now() + 30_000;
    const res = rateLimited(true, { limit: 600, remaining: 0, reset, window: "minute" });
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      message: string;
      limit: number;
      remaining: number;
      resetsAt: string;
      window: string;
      upgradeUrl?: string;
    };
    expect(body.message).toContain("Rate limit reached: 600 tool calls per minute.");
    expect(body.message).toMatch(/Resets at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\./);
    expect(body.message).toContain("Slow down and retry.");
    expect(body.limit).toBe(600);
    expect(body.remaining).toBe(0);
    expect(body.window).toBe("minute");
    expect(new Date(body.resetsAt).getTime()).toBe(reset);
    expect(body.upgradeUrl).toBeUndefined();
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(29);
    expect(retryAfter).toBeLessThanOrEqual(31);
  });

  it.each(["free", "pro", "team"] as const)(
    "%s plan, daily window: no upgrade wording, no trial, no billing link",
    async (plan) => {
      const res = rateLimited(true, {
        plan,
        limit: 50,
        remaining: 0,
        reset: Date.now() + HOUR_MS,
      });
      const body = (await res.json()) as { message: string; plan: string; upgradeUrl?: string };
      expect(body.message).toContain("Rate limit reached: 50 requests per day.");
      expect(body.message).toMatch(/Resets at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\./);
      expect(body.message).toContain("Contact hello@twinmcp.fr if you need more.");
      expect(body.message).not.toMatch(/Pro raises|first month|Upgrade|dashboard\/billing/);
      expect(body.plan).toBe(plan);
      expect(body.upgradeUrl).toBeUndefined();
    }
  );

  it("REST per-minute window counts requests, not tool calls", async () => {
    const res = rateLimited(true, {
      limit: 600,
      remaining: 0,
      reset: Date.now() + 30_000,
      window: "minute",
      unit: "requests",
    });
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Rate limit reached: 600 requests per minute.");
  });

  it("sets Retry-After and X-RateLimit-* headers from the window", () => {
    const now = Date.now();
    const reset = now + 90 * 60 * 1000; // 90 minutes
    const res = rateLimited(true, { plan: "free", limit: 50, remaining: 0, reset });

    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(89 * 60);
    expect(retryAfter).toBeLessThanOrEqual(90 * 60 + 1);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("50");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(res.headers.get("X-RateLimit-Reset"))).toBe(Math.ceil(reset / 1000));
  });

  it("clamps Retry-After to at least 1 second and never reports negative remaining", () => {
    const res = rateLimited(true, {
      plan: "free",
      limit: 50,
      remaining: -3,
      reset: Date.now() - 5000, // already past: falls back to the next UTC midnight
    });
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    const resetSec = Number(res.headers.get("X-RateLimit-Reset"));
    expect(resetSec * 1000).toBeGreaterThan(Date.now());
  });

  it("a past reset on the minute window falls back to about a minute, not midnight", () => {
    const res = rateLimited(true, { limit: 600, remaining: 0, reset: 0, window: "minute" });
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(59);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("anonymous callers with details get headers and the create-key hint", async () => {
    const res = rateLimited(false, { limit: 10, remaining: 0, reset: Date.now() + HOUR_MS });
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Rate limit reached: 10 requests per day");
    expect(body.message).toContain("Create a free API key");
  });

  it("rateLimitMessage is the exact 429 body text", async () => {
    const resetAt = new Date("2026-10-29T10:31:07.000Z");
    expect(rateLimitMessage(true, { limit: 600, window: "minute" }, resetAt)).toBe(
      "Rate limit reached: 600 tool calls per minute. Resets at 2026-10-29T10:31:07Z. Slow down and retry."
    );
  });
});

describe("credit error constants (contract W2)", () => {
  it("are the contract's text and links", () => {
    expect(CREDIT_EXHAUSTED_MESSAGE).toBe(
      "Your TwinMCP credit is used up. Top up at https://twinmcp.fr/dashboard/billing"
    );
    expect(CREDIT_TOPUP_URL).toBe("https://twinmcp.fr/dashboard/billing");
    expect(CREDIT_DOCS_URL).toBe("https://twinmcp.fr/docs#credit");
  });
});
