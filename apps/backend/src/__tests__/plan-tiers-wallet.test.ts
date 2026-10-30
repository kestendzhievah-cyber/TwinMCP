import { describe, it, expect, beforeAll } from "vitest";
import {
  allowedBoxSizes,
  can,
  isBoxSizeAllowed,
  limitFor,
  minPlanForBoxSize,
  PLAN_CAPABILITIES,
  PLAN_LABELS,
  PlanRestrictionError,
  requiredTierMessage,
} from "@/lib/plan-features";

// Since 2026-10-29 the tiers are wallet states: "free" = Free credit (never
// funded), "pro" = Pay as you go (funded by a first top-up).
describe("plan tiers (wallet model)", () => {
  it("labels the tiers by wallet state", () => {
    expect(PLAN_LABELS.free).toBe("Free credit");
    expect(PLAN_LABELS.pro).toBe("Pay as you go");
    expect(PLAN_LABELS.team).toBe("Team");
  });

  it("Free credit: 1 small server, no publishing", () => {
    expect(limitFor("free", "servers")).toBe(1);
    expect(allowedBoxSizes("free")).toEqual(["small"]);
    expect(isBoxSizeAllowed("free", "medium")).toBe(false);
    expect(isBoxSizeAllowed("free", "large")).toBe(false);
    expect(can("free", "publishMcp")).toBe(false);
  });

  it("Pay as you go: 50 servers, every size, publishing", () => {
    expect(limitFor("pro", "servers")).toBe(50);
    expect(allowedBoxSizes("pro")).toEqual(["small", "medium", "large"]);
    expect(can("pro", "publishMcp")).toBe(true);
    expect(minPlanForBoxSize("large")).toBe("pro");
  });

  it("keeps the retention values", () => {
    expect(PLAN_CAPABILITIES.free.activityRetentionDays).toBe(7);
    expect(PLAN_CAPABILITIES.free.auditRetentionDays).toBe(0);
    expect(PLAN_CAPABILITIES.pro.activityRetentionDays).toBe(90);
    expect(PLAN_CAPABILITIES.pro.auditRetentionDays).toBe(90);
  });

  it("upsell messages point at a top-up, not a plan", () => {
    expect(requiredTierMessage("pro", "The large box size")).toBe(
      "The large box size needs a funded wallet: top up your TwinMCP credit to unlock it."
    );
    expect(new PlanRestrictionError("x", "pro").message).toMatch(/top up/);
    expect(new PlanRestrictionError("x", "pro").message).not.toMatch(/Pro plan/);
    expect(requiredTierMessage("team")).toBe("This action requires the Team plan.");
  });
});

describe("checkAbuseLimit — per-minute, fail-open without Redis", () => {
  let mod: typeof import("@/lib/rate-limit");

  beforeAll(async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    mod = await import("@/lib/rate-limit");
  }, 30_000);

  it("allows the request and reports the per-minute limit when Redis is unavailable", async () => {
    const res = await mod.checkAbuseLimit("user_test");
    expect(res).toEqual({
      ok: true,
      limit: mod.ABUSE_LIMIT_PER_MINUTE,
      remaining: mod.ABUSE_LIMIT_PER_MINUTE,
      reset: 0,
    });
    expect(mod.ABUSE_LIMIT_PER_MINUTE).toBe(600);
  });
});
