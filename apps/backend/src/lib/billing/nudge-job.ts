import { and, eq, gte, or, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users, servers, userServers, usageMetrics, mcpServers, type Plan } from "@/db/schema";
import { getDailyLimit } from "@/lib/rate-limit";
import { PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { nextUtcMidnight, type NudgeReason } from "@/lib/billing/upgrade-state";
import {
  emailNudgesEnabled,
  firstToolCallAt,
  nudgeState,
  parseNudgeDate,
  stampNudge,
  withinNudgeCooldown,
  type NudgeKind,
} from "@/lib/billing/nudge-state";
import { sendActivationEmail, sendProOfferEmail, sendQuotaLimitEmail } from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";

export { NUDGE_COOLDOWN_DAYS, emailNudgesEnabled, type NudgeKind } from "@/lib/billing/nudge-state";

/**
 * Lifecycle nudge emails — the scheduled half of the Free → Pro system, plus
 * the activation reminder.
 *
 * Runs once a day (/api/cron/nudges or the "upgrade-nudges" QStash job) and
 * sends at most ONE email per account per 7 days:
 *
 *  - "quota_limit"  the account hit the Free daily MCP quota on ≥ 2 of the last
 *                   7 UTC days (their IDE was being rejected). Repeated at most
 *                   every 14 days while it keeps happening.
 *  - "offer"        an ACTIVATED Free account (≥ 3 days old, a live server, an
 *                   installed MCP, real requests this week) that has never been
 *                   offered Pro by email. Sent once, ever.
 *  - "activation"   any plan: an account ≥ 24 h and < 7 days old with no first
 *                   tool call yet (users.metadata.firstToolCallAt unset, no
 *                   request recorded): the four setup steps, once, ever.
 *
 * State lives in users.metadata.nudges ({ lastEmailAt, offerAt, quotaLimitAt, activationAt },
 * shared with the proxy's quota-limit email — lib/billing/nudge-state.ts) and
 * users.metadata.emailNudges (false = opted out) — no table, no migration.
 *
 * selectNudgeCandidates() is pure so every rule has a unit test; the DB and
 * email sides are thin wrappers around it.
 */

export interface CandidateRow {
  userId: string;
  email: string;
  plan: Plan;
  createdAt: Date;
  stripeCustomerId: string | null;
  metadata: Record<string, unknown> | null;
  /** Servers not destroyed. */
  serverCount: number;
  /** Installed MCPs (user_servers rows on live servers, minus the auto-installed twinmcp-docs). */
  mcpCount: number;
  /** sum(request_count) over the last 7 UTC days. */
  requests7d: number;
  /** UTC days in the last 7 where the per-user sum reached the Free daily limit. */
  daysAtLimit7d: number;
}

export interface NudgeDecision {
  userId: string;
  email: string;
  kind: NudgeKind;
  /** Stable, low-cardinality value for analytics (NudgeReason, or "activation"). */
  reason: NudgeReason | "activation";
  /** Human-readable why — for the dry-run output and logs. */
  detail: string;
}

/** A quota-limit nudge is not repeated within this window. */
export const QUOTA_NUDGE_REPEAT_DAYS = 14;
/** An account younger than this is still onboarding — no offer yet. */
export const ACTIVATION_MIN_AGE_DAYS = 3;
/** Days at the Free limit (in the last 7) before the quota nudge fires. */
export const QUOTA_LIMIT_MIN_DAYS = 2;
/** The activation email waits this long after sign-up for a first tool call. */
export const ACTIVATION_EMAIL_DELAY_HOURS = 24;
/**
 * Older accounts never get the activation email: it is a first-week reminder,
 * and accounts from before the relay stamped firstToolCallAt must not be told
 * to make a first call they made long ago.
 */
export const ACTIVATION_EMAIL_MAX_AGE_DAYS = 7;
/** Accounts created without a verified email get this synthetic address. */
export const PLACEHOLDER_EMAIL_SUFFIX = "@placeholder.twinmcp.fr";

const DAY_MS = 86_400_000;

const HOUR_MS = 3_600_000;

/** The activation reminder: young account, no tool call yet, never reminded. */
function activationDecision(
  row: CandidateRow,
  email: string,
  state: ReturnType<typeof nudgeState>,
  now: Date
): NudgeDecision | null {
  const ageMs = now.getTime() - row.createdAt.getTime();
  if (ageMs < ACTIVATION_EMAIL_DELAY_HOURS * HOUR_MS) return null;
  if (ageMs >= ACTIVATION_EMAIL_MAX_AGE_DAYS * DAY_MS) return null;
  if (firstToolCallAt(row.metadata)) return null;
  // Any request recorded means a client is already connected.
  if (row.requests7d > 0) return null;
  if (parseNudgeDate(state.activationAt)) return null;
  return {
    userId: row.userId,
    email,
    kind: "activation",
    reason: "activation",
    detail: `no tool call yet, account ${Math.floor(ageMs / HOUR_MS)} hour(s) old, ${row.serverCount} server(s), ${row.mcpCount} MCP(s)`,
  };
}

function decideForRow(row: CandidateRow, now: Date): NudgeDecision | null {
  const email = (row.email ?? "").trim();
  if (!email || email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return null;
  if (!emailNudgesEnabled(row.metadata)) return null;
  // The global floor, whichever sender (job or proxy) emailed last.
  if (withinNudgeCooldown(row.metadata, now)) return null;

  const state = nudgeState(row.metadata);

  // The upgrade nudges are for Free accounts only.
  if (row.plan === "free") {
    if (row.daysAtLimit7d >= QUOTA_LIMIT_MIN_DAYS) {
      const quotaLimitAt = parseNudgeDate(state.quotaLimitAt);
      const repeatable =
        !quotaLimitAt || now.getTime() - quotaLimitAt.getTime() >= QUOTA_NUDGE_REPEAT_DAYS * DAY_MS;
      if (repeatable) {
        return {
          userId: row.userId,
          email,
          kind: "quota_limit",
          reason: "quota_limit",
          detail: `at the Free daily limit on ${row.daysAtLimit7d} of the last 7 days`,
        };
      }
    }

    const ageDays = (now.getTime() - row.createdAt.getTime()) / DAY_MS;
    const activated =
      ageDays >= ACTIVATION_MIN_AGE_DAYS &&
      row.serverCount >= 1 &&
      row.mcpCount >= 1 &&
      row.requests7d > 0;
    if (activated && !parseNudgeDate(state.offerAt)) {
      return {
        userId: row.userId,
        email,
        kind: "offer",
        reason: "offer",
        detail: `activated: ${row.serverCount} server(s), ${row.mcpCount} MCP(s), ${row.requests7d} request(s) in 7 days, account ${Math.floor(ageDays)} day(s) old`,
      };
    }
  }

  // Any plan: a Pro trial that never connected needs the steps as much.
  return activationDecision(row, email, state, now);
}

/**
 * The one decision per account. Pure: same rows + same clock, same output.
 * Ordered oldest-nudged first (never-nudged accounts lead) so a capped run
 * never starves the same accounts twice.
 */
export function selectNudgeCandidates(rows: CandidateRow[], now: Date): NudgeDecision[] {
  const picked: Array<{ decision: NudgeDecision; lastEmailAt: number }> = [];
  for (const row of rows) {
    const decision = decideForRow(row, now);
    if (!decision) continue;
    const last = parseNudgeDate(nudgeState(row.metadata).lastEmailAt);
    picked.push({ decision, lastEmailAt: last ? last.getTime() : 0 });
  }
  picked.sort((a, b) => a.lastEmailAt - b.lastEmailAt);
  return picked.map((p) => p.decision);
}

type Db = ReturnType<typeof getDb>;

/**
 * Free accounts, plus young accounts of any plan with no first tool call yet
 * (the activation reminder), with their server/MCP counts and
 * last-7-UTC-days usage. Two
 * queries: users with correlated counts, then usage per (user, UTC day) —
 * usage_metrics.period_start is already a UTC day bucket (lib/usage-metrics).
 */
export async function loadCandidateRows(db: Db, now: Date): Promise<CandidateRow[]> {
  const freeLimit = getDailyLimit("free");
  // Today (partial) plus the 6 previous UTC days.
  const since = new Date(nextUtcMidnight(now).getTime() - 7 * DAY_MS);

  const serverCount = sql<number>`(select count(*) from ${servers} where ${servers.userId} = ${users.id} and ${servers.status} <> 'destroyed')::int`;
  // twinmcp-docs is auto-installed on every box server, so it is no activation
  // signal: only MCPs the user chose count.
  const mcpCount = sql<number>`(select count(*) from ${userServers} inner join ${servers} on ${servers.id} = ${userServers.serverId} inner join ${mcpServers} on ${mcpServers.id} = ${userServers.mcpServerId} where ${userServers.userId} = ${users.id} and ${servers.status} <> 'destroyed' and ${mcpServers.slug} <> ${TWINMCP_DOCS_SLUG})::int`;

  const [userRows, usageRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        email: users.email,
        plan: users.plan,
        createdAt: users.createdAt,
        stripeCustomerId: users.stripeCustomerId,
        metadata: users.metadata,
        serverCount,
        mcpCount,
      })
      .from(users)
      .where(
        or(
          eq(users.plan, "free"),
          and(
            gte(users.createdAt, new Date(now.getTime() - ACTIVATION_EMAIL_MAX_AGE_DAYS * DAY_MS)),
            sql`(${users.metadata}->>'firstToolCallAt') IS NULL`
          )
        )
      ),
    db
      .select({
        userId: userServers.userId,
        periodStart: usageMetrics.periodStart,
        req: sql<number>`coalesce(sum(${usageMetrics.requestCount}),0)::int`,
      })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(gte(usageMetrics.periodStart, since))
      .groupBy(userServers.userId, usageMetrics.periodStart),
  ]);

  const usage = new Map<string, { requests7d: number; daysAtLimit7d: number }>();
  for (const r of usageRows) {
    const entry = usage.get(r.userId) ?? { requests7d: 0, daysAtLimit7d: 0 };
    const req = Number(r.req) || 0;
    entry.requests7d += req;
    if (req >= freeLimit) entry.daysAtLimit7d += 1;
    usage.set(r.userId, entry);
  }

  return userRows.map((u) => ({
    userId: u.userId,
    email: u.email,
    plan: u.plan,
    createdAt: u.createdAt,
    stripeCustomerId: u.stripeCustomerId,
    metadata: u.metadata ?? {},
    serverCount: Number(u.serverCount) || 0,
    mcpCount: Number(u.mcpCount) || 0,
    requests7d: usage.get(u.userId)?.requests7d ?? 0,
    daysAtLimit7d: usage.get(u.userId)?.daysAtLimit7d ?? 0,
  }));
}

export interface RunNudgesOptions {
  /** Compute the decisions, send nothing, stamp nothing. */
  dryRun?: boolean;
  /** Max emails per run (oldest-nudged first). */
  limit?: number;
  now?: Date;
}

export interface RunNudgesResult {
  /** Accounts examined (Free, plus young accounts with no first tool call). */
  scanned: number;
  /** What was (or, in dry-run, would be) sent — already capped at `limit`. */
  decisions: NudgeDecision[];
  sent: number;
  errors: number;
  /** Set when nothing could go out at all (no Resend key). */
  skipped?: "no_resend_key";
}

export async function runUpgradeNudges({
  dryRun = false,
  limit = 200,
  now = new Date(),
}: RunNudgesOptions = {}): Promise<RunNudgesResult> {
  const db = getDb();
  const rows = await loadCandidateRows(db, now);
  const decisions = selectNudgeCandidates(rows, now).slice(0, Math.max(0, limit));
  const result: RunNudgesResult = { scanned: rows.length, decisions, sent: 0, errors: 0 };
  if (dryRun || decisions.length === 0) return result;

  // The senders throw without a key; one warning beats N Sentry events a day.
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      `[upgrade-nudge] RESEND_API_KEY not set — ${decisions.length} nudge email(s) not sent`
    );
    return { ...result, skipped: "no_resend_key" };
  }

  const byId = new Map(rows.map((r) => [r.userId, r]));
  const freeLimit = getDailyLimit("free");
  const proDailyLimit = getDailyLimit("pro");
  const resetsAt = nextUtcMidnight(now);

  for (const decision of decisions) {
    const row = byId.get(decision.userId);
    if (!row) continue;
    // A Stripe customer already used the first-month trial.
    const trialDays = row.stripeCustomerId ? 0 : PRO_TRIAL_DAYS;
    try {
      if (decision.kind === "activation") {
        await sendActivationEmail(decision.email);
      } else if (decision.kind === "offer") {
        await sendProOfferEmail(decision.email, { trialDays, proDailyLimit });
      } else {
        await sendQuotaLimitEmail(decision.email, {
          used: freeLimit,
          limit: freeLimit,
          resetsAt,
          trialDays,
          proDailyLimit,
        });
      }
      await stampNudge(db, row.userId, row.metadata, decision.kind, now);
      trackServer({
        event: "upgrade_email_sent",
        distinctId: decision.userId,
        properties: { kind: decision.kind, reason: decision.reason },
      });
      result.sent += 1;
    } catch (err) {
      // One failure never stops the batch; the unstamped account is retried
      // on the next run.
      result.errors += 1;
      console.warn(
        `[upgrade-nudge] ${decision.kind} email for user ${decision.userId} failed:`,
        err
      );
      Sentry.captureException(err, {
        tags: { area: "upgrade-nudge", stage: "job" },
        extra: { userId: decision.userId, kind: decision.kind },
      });
    }
  }

  return result;
}
