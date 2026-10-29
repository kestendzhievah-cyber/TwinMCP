import { describe, expect, it } from "vitest";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import {
  ACTIVITY_RETENTION_DAYS,
  AUDIT_LOG_MIN_RETENTION_DAYS,
  activityCutoff,
  activityRetentionDays,
  auditPurgeDays,
  auditPurgeDaysByPlan,
  cutoffFor,
  retentionGroups,
} from "@/lib/activity/retention";

const DAY = 86_400_000;
const NOW = new Date("2026-10-28T12:00:00.000Z");

describe("activity retention per plan", () => {
  it("Free keeps 7 days, Pro 90 (plan-features is the source)", () => {
    expect(PLAN_CAPABILITIES.free.activityRetentionDays).toBe(7);
    expect(PLAN_CAPABILITIES.pro.activityRetentionDays).toBe(90);
    expect(ACTIVITY_RETENTION_DAYS).toEqual({
      free: PLAN_CAPABILITIES.free.activityRetentionDays,
      pro: PLAN_CAPABILITIES.pro.activityRetentionDays,
      team: PLAN_CAPABILITIES.team.activityRetentionDays,
    });
  });

  it("treats an unknown or missing plan as Free", () => {
    expect(activityRetentionDays("free")).toBe(7);
    expect(activityRetentionDays("pro")).toBe(90);
    expect(activityRetentionDays(undefined)).toBe(7);
    expect(activityRetentionDays(null)).toBe(7);
    expect(activityRetentionDays("enterprise")).toBe(7);
    expect(activityRetentionDays("__proto__")).toBe(7);
  });

  it("computes cutoffs relative to now", () => {
    expect(activityCutoff("free", NOW).getTime()).toBe(NOW.getTime() - 7 * DAY);
    expect(activityCutoff("pro", NOW).getTime()).toBe(NOW.getTime() - 90 * DAY);
    expect(cutoffFor(0, NOW).getTime()).toBe(NOW.getTime());
    expect(cutoffFor(-5, NOW).getTime()).toBe(NOW.getTime());
    expect(cutoffFor(Number.NaN, NOW).getTime()).toBe(NOW.getTime());
  });
});

describe("audit purge window", () => {
  it("never goes below the floor, even for Free (0 = not surfaced)", () => {
    expect(PLAN_CAPABILITIES.free.auditRetentionDays).toBe(0);
    expect(auditPurgeDays("free")).toBe(AUDIT_LOG_MIN_RETENTION_DAYS);
    expect(auditPurgeDays("pro")).toBe(
      Math.max(PLAN_CAPABILITIES.pro.auditRetentionDays, AUDIT_LOG_MIN_RETENTION_DAYS)
    );
    expect(auditPurgeDays("nonsense")).toBe(AUDIT_LOG_MIN_RETENTION_DAYS);
  });

  it("keeps at least the 7-day churn-alert dedup window", () => {
    for (const days of Object.values(auditPurgeDaysByPlan())) {
      expect(days).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("retentionGroups", () => {
  it("groups plans sharing a window, shortest first, default plan flagged", () => {
    expect(retentionGroups({ free: 7, pro: 90, team: 90 })).toEqual([
      { days: 7, plans: ["free"], includesUnknown: true },
      { days: 90, plans: ["pro", "team"], includesUnknown: false },
    ]);
  });

  it("collapses to one group when every plan agrees", () => {
    expect(retentionGroups({ free: 90, pro: 90, team: 90 })).toEqual([
      { days: 90, plans: ["free", "pro", "team"], includesUnknown: true },
    ]);
  });

  it("skips invalid windows", () => {
    expect(retentionGroups({ free: 7, pro: Number.NaN, team: -1 })).toEqual([
      { days: 7, plans: ["free"], includesUnknown: true },
    ]);
  });

  it("matches the live plan table", () => {
    const groups = retentionGroups(ACTIVITY_RETENTION_DAYS);
    const covered = groups.flatMap((g) => g.plans).sort();
    expect(covered).toEqual(["free", "pro", "team"]);
    expect(groups.filter((g) => g.includesUnknown)).toHaveLength(1);
  });
});
