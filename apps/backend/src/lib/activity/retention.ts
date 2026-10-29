import type { Plan } from "@/db/schema/core";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";

/**
 * Retention rules for the tool-call activity log and the audit log.
 *
 * Pure and type-only on the schema side, so it is safe to import from Server
 * and Client Components. The numbers live in lib/plan-features.ts; this module
 * only derives cutoffs from them and groups plans for the purge job.
 */

const DAY_MS = 86_400_000;

const ALL_PLANS = Object.keys(PLAN_CAPABILITIES) as Plan[];

/** The plan an account without a known plan is treated as (the column default). */
export const DEFAULT_PLAN: Plan = "free";

/** Tool-call activity retention in days, per plan (Free 7, Pro 90). */
export const ACTIVITY_RETENTION_DAYS: Readonly<Record<Plan, number>> = Object.freeze(
  Object.fromEntries(
    ALL_PLANS.map((p) => [p, PLAN_CAPABILITIES[p].activityRetentionDays])
  ) as Record<Plan, number>
);

/**
 * Audit-log rows are kept at least this long whatever the plan. Free shows no
 * audit log (auditRetentionDays 0 = "not surfaced"), but the rows still back
 * security investigations and internal dedup (e.g. churn alerts look back
 * 7 days), and an account upgrading to Pro sees the history the plan promises.
 * Matches the 90-day technical-log retention stated in the privacy policy.
 */
export const AUDIT_LOG_MIN_RETENTION_DAYS = 90;

function knownPlan(plan: string | null | undefined): Plan {
  return plan && Object.prototype.hasOwnProperty.call(PLAN_CAPABILITIES, plan)
    ? (plan as Plan)
    : DEFAULT_PLAN;
}

/** Days of tool-call activity a plan keeps (unknown / missing plan → Free). */
export function activityRetentionDays(plan: string | null | undefined): number {
  return ACTIVITY_RETENTION_DAYS[knownPlan(plan)];
}

/** Days of audit log the purge keeps for a plan (never below the floor). */
export function auditPurgeDays(plan: string | null | undefined): number {
  return Math.max(
    PLAN_CAPABILITIES[knownPlan(plan)].auditRetentionDays,
    AUDIT_LOG_MIN_RETENTION_DAYS
  );
}

/** The instant `days` days before `now`: rows created before it are expired. */
export function cutoffFor(days: number, now: Date = new Date()): Date {
  const d = Number.isFinite(days) && days > 0 ? days : 0;
  return new Date(now.getTime() - d * DAY_MS);
}

/** Oldest tool call a plan may still see / keep. */
export function activityCutoff(plan: string | null | undefined, now: Date = new Date()): Date {
  return cutoffFor(activityRetentionDays(plan), now);
}

export interface RetentionGroup {
  /** Rows older than this many days are deleted for the plans below. */
  days: number;
  /** Plans sharing this retention. */
  plans: Plan[];
  /**
   * True for the group holding the default plan: it also covers accounts whose
   * plan column holds anything unexpected, so no row escapes the purge.
   */
  includesUnknown: boolean;
}

/**
 * Group plans by retention so the purge runs one batched DELETE per distinct
 * window instead of one per plan. Sorted shortest window first.
 */
export function retentionGroups(daysByPlan: Readonly<Record<Plan, number>>): RetentionGroup[] {
  const byDays = new Map<number, Plan[]>();
  for (const plan of Object.keys(daysByPlan) as Plan[]) {
    const days = daysByPlan[plan];
    if (!Number.isFinite(days) || days < 0) continue;
    const list = byDays.get(days) ?? [];
    list.push(plan);
    byDays.set(days, list);
  }
  return [...byDays.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([days, plans]) => ({ days, plans, includesUnknown: plans.includes(DEFAULT_PLAN) }));
}

/** Audit purge windows per plan (plan retention, floored). */
export function auditPurgeDaysByPlan(): Record<Plan, number> {
  return Object.fromEntries(ALL_PLANS.map((p) => [p, auditPurgeDays(p)])) as Record<Plan, number>;
}
