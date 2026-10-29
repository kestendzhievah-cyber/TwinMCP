import { and, eq, inArray, isNotNull, lt, notInArray, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { users, plans, type Plan } from "@/db/schema/core";
import { auditLogs } from "@/db/schema/platform";
import { toolCalls } from "@/db/schema/activity";
import { webhookDeliveries } from "@/db/schema/webhooks";
import {
  ACTIVITY_RETENTION_DAYS,
  auditPurgeDaysByPlan,
  cutoffFor,
  retentionGroups,
  type RetentionGroup,
} from "./retention";

/**
 * Retention purge (run daily by /api/cron/purge or the "purge-retention" job):
 *  - tool_calls older than the owner's plan activity retention (Free 7, Pro 90);
 *  - audit_logs older than the owner's plan audit retention, floored at
 *    AUDIT_LOG_MIN_RETENTION_DAYS;
 *  - finished webhook_deliveries (success / failed / cancelled) older than
 *    WEBHOOK_DELIVERY_RETENTION_DAYS, whatever the plan.
 *
 * Deletes in batches (DELETE … WHERE id IN (SELECT … LIMIT n)) so no single
 * statement holds long locks, and stops at a time budget — the next run picks
 * up where this one stopped.
 *
 * Audit rows whose user was deleted (user_id NULL — anonymized on account
 * deletion and kept for security / legal obligations, see the privacy policy)
 * are NOT touched here: how long those stay is a policy decision.
 */

/** Days a finished webhook delivery stays in the dashboard's history. */
export const WEBHOOK_DELIVERY_RETENTION_DAYS = 30;

export interface PurgeOptions {
  /** Rows per DELETE (default 5000). */
  batchSize?: number;
  /** Stop starting new batches after this many ms (default 50 s). */
  maxMs?: number;
  now?: Date;
}

export interface PurgeResult {
  toolCalls: number;
  auditLogs: number;
  webhookDeliveries: number;
  batches: number;
  /** True when the time budget ran out before everything expired was deleted. */
  truncated: boolean;
  durationMs: number;
}

/** Owner-plan condition for a retention group (the default plan's group also
 *  catches any unexpected plan value). */
function planCondition(group: RetentionGroup): SQL {
  if (group.includesUnknown) {
    const others = plans.filter((p) => !group.plans.includes(p));
    return others.length > 0 ? notInArray(users.plan, others) : isNotNull(users.id);
  }
  return inArray(users.plan, group.plans as Plan[]);
}

export async function purgeExpiredRecords(opts: PurgeOptions = {}): Promise<PurgeResult> {
  const started = Date.now();
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 5_000, 50_000));
  const maxMs = opts.maxMs ?? 50_000;
  const now = opts.now ?? new Date();
  const db = getDb();

  const result: PurgeResult = {
    toolCalls: 0,
    auditLogs: 0,
    webhookDeliveries: 0,
    batches: 0,
    truncated: false,
    durationMs: 0,
  };
  const outOfTime = () => Date.now() - started >= maxMs;

  // Tool calls: per retention window, owners joined for their plan.
  for (const group of retentionGroups(ACTIVITY_RETENTION_DAYS)) {
    const cutoff = cutoffFor(group.days, now);
    for (;;) {
      if (outOfTime()) {
        result.truncated = true;
        break;
      }
      const expired = db
        .select({ id: toolCalls.id })
        .from(toolCalls)
        .innerJoin(users, eq(users.id, toolCalls.userId))
        .where(and(planCondition(group), lt(toolCalls.createdAt, cutoff)))
        .limit(batchSize);
      const deleted = await db
        .delete(toolCalls)
        .where(inArray(toolCalls.id, expired))
        .returning({ id: toolCalls.id });
      result.batches++;
      result.toolCalls += deleted.length;
      if (deleted.length < batchSize) break;
    }
  }

  // Audit logs: same shape, plan audit retention with the floor.
  for (const group of retentionGroups(auditPurgeDaysByPlan())) {
    const cutoff = cutoffFor(group.days, now);
    for (;;) {
      if (outOfTime()) {
        result.truncated = true;
        break;
      }
      const expired = db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .where(and(planCondition(group), lt(auditLogs.createdAt, cutoff)))
        .limit(batchSize);
      const deleted = await db
        .delete(auditLogs)
        .where(inArray(auditLogs.id, expired))
        .returning({ id: auditLogs.id });
      result.batches++;
      result.auditLogs += deleted.length;
      if (deleted.length < batchSize) break;
    }
  }

  // Webhook delivery history: finished deliveries only (pending / retrying
  // rows are still owed an attempt), same window for every plan.
  {
    const cutoff = cutoffFor(WEBHOOK_DELIVERY_RETENTION_DAYS, now);
    for (;;) {
      if (outOfTime()) {
        result.truncated = true;
        break;
      }
      const expired = db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(
          and(
            inArray(webhookDeliveries.status, ["success", "failed", "cancelled"]),
            lt(webhookDeliveries.createdAt, cutoff)
          )
        )
        .limit(batchSize);
      const deleted = await db
        .delete(webhookDeliveries)
        .where(inArray(webhookDeliveries.id, expired))
        .returning({ id: webhookDeliveries.id });
      result.batches++;
      result.webhookDeliveries += deleted.length;
      if (deleted.length < batchSize) break;
    }
  }

  result.durationMs = Date.now() - started;
  return result;
}
