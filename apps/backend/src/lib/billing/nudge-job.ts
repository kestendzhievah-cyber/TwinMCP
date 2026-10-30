import { and, eq, gte, or, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users, servers, userServers, usageMetrics, mcpServers, type Plan } from "@/db/schema";
import { walletAccounts } from "@/db/schema/wallet";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { LOW_BALANCE_MICROS, nextUtcMidnight } from "@/lib/billing/upgrade-state";
import {
  emailNudgesEnabled,
  firstToolCallAt,
  nudgeState,
  parseNudgeDate,
  stampNudge,
  withinNudgeCooldown,
} from "@/lib/billing/nudge-state";
import { sendActivationEmail } from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";
import {
  MONEY_CRITICAL_EVENTS,
  decideWalletNotification,
  notifyKey,
  notifyWalletStateWithOutcome,
  refFor,
  staleReason,
  type NotifyContext,
  type NotifyOutcome,
  type WalletEvent,
} from "@/lib/wallet/notify";

export { NUDGE_COOLDOWN_DAYS, emailNudgesEnabled, type NudgeKind } from "@/lib/billing/nudge-state";

/**
 * Lifecycle emails: the scheduled half of the wallet notices, plus the
 * activation reminder.
 *
 * Runs once a day (/api/cron/wallet-reminders, /api/cron/nudges or the
 * "upgrade-nudges" QStash job) and picks at most ONE email per account:
 *
 *  - wallet notices (sent through lib/wallet/notify.ts, which dedupes them in
 *    wallet_accounts.notified and re-checks them against fresh data), in this
 *    order of priority:
 *      zero_balance              catch-up when the debit-time notice was missed
 *      low_balance               0 < balance < LOW_BALANCE_MICROS (catch-up)
 *      promo_expiring_2d         free credit left, expiring within 2 days
 *      promo_expiring_7d         free credit left, expiring within 7 days
 *  - "activation" (any account): ≥ 24 h and < 7 days old with no first tool
 *    call yet: the four setup steps, once, ever (users.metadata.nudges).
 *
 * The daily Free → Pro offer and quota emails are gone with the subscription.
 *
 * selectNudgeCandidates() is pure so every rule has a unit test; the DB and
 * email sides are thin wrappers around it.
 */

export interface CandidateWallet {
  paidMicros: number;
  /** Unexpired promo credit. */
  promoMicros: number;
  promoExpiresAt: Date | null;
  funded: boolean;
  zeroBalanceAt: Date | null;
  autoRechargeEnabled: boolean;
  notified: unknown;
  lastCreditAt: Date | null;
}

export interface CandidateRow {
  userId: string;
  email: string;
  plan: Plan;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
  /** Servers not destroyed. */
  serverCount: number;
  /** Installed MCPs (user_servers rows on live servers, minus the auto-installed twinmcp-docs). */
  mcpCount: number;
  /** sum(request_count) over the last 7 UTC days. */
  requests7d: number;
  /** null when the account has no wallet row yet. */
  wallet: CandidateWallet | null;
}

export type NudgeDecisionKind = "activation" | WalletEvent;

export interface NudgeDecision {
  userId: string;
  email: string;
  kind: NudgeDecisionKind;
  /** Stable, low-cardinality value for analytics. */
  reason: string;
  /** Human-readable why: for the dry-run output and logs. */
  detail: string;
  /** Passed to notifyWalletState for wallet kinds. */
  data?: Record<string, unknown>;
}

/** The activation email waits this long after sign-up for a first tool call. */
export const ACTIVATION_EMAIL_DELAY_HOURS = 24;
/**
 * Older accounts never get the activation email: it is a first-week reminder,
 * and accounts from before the relay stamped firstToolCallAt must not be told
 * to make a first call they made long ago.
 */
export const ACTIVATION_EMAIL_MAX_AGE_DAYS = 7;
/** The two promo reminders, in days before the expiry. */
export const PROMO_REMINDER_DAYS = { first: 7, last: 2 } as const;
/** Accounts created without a verified email get this synthetic address. */
export const PLACEHOLDER_EMAIL_SUFFIX = "@placeholder.twinmcp.fr";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** The activation reminder: young account, no tool call yet, never reminded. */
function activationDecision(row: CandidateRow, email: string, now: Date): NudgeDecision | null {
  if (!emailNudgesEnabled(row.metadata)) return null;
  // The global floor between two users.metadata.nudges emails.
  if (withinNudgeCooldown(row.metadata, now)) return null;
  const ageMs = now.getTime() - row.createdAt.getTime();
  if (ageMs < ACTIVATION_EMAIL_DELAY_HOURS * HOUR_MS) return null;
  if (ageMs >= ACTIVATION_EMAIL_MAX_AGE_DAYS * DAY_MS) return null;
  if (firstToolCallAt(row.metadata)) return null;
  // Any request recorded means a client is already connected.
  if (row.requests7d > 0) return null;
  if (parseNudgeDate(nudgeState(row.metadata).activationAt)) return null;
  return {
    userId: row.userId,
    email,
    kind: "activation",
    reason: "activation",
    detail: `no tool call yet, account ${Math.floor(ageMs / HOUR_MS)} hour(s) old, ${row.serverCount} server(s), ${row.mcpCount} MCP(s)`,
  };
}

/** The wallet notices a row qualifies for, loudest first (before dedupe). */
export function walletCandidates(
  row: CandidateRow,
  now: Date
): Array<{ event: WalletEvent; data: Record<string, unknown>; detail: string }> {
  const w = row.wallet;
  if (!w) return [];
  const total = w.paidMicros + w.promoMicros;
  const out: Array<{ event: WalletEvent; data: Record<string, unknown>; detail: string }> = [];

  if (total <= 0 && w.zeroBalanceAt) {
    const days = Math.floor((now.getTime() - w.zeroBalanceAt.getTime()) / DAY_MS);
    // Runtime-deletion warnings are NOT sent here: the wallet enforcer
    // (lib/wallet/compute-meter.ts runWalletEnforce) owns them, because it is
    // the job that deletes, it counts from its own start date, and it refuses
    // to delete unless its own warnings were actually delivered.
    out.push({ event: "zero_balance", data: {}, detail: `balance at zero for ${days} day(s)` });
  } else if (total > 0 && total < LOW_BALANCE_MICROS) {
    out.push({ event: "low_balance", data: {}, detail: `balance ${total} micro-euros` });
  }

  if (w.promoMicros > 0 && w.promoExpiresAt) {
    const left = w.promoExpiresAt.getTime() - now.getTime();
    if (left > 0 && left <= PROMO_REMINDER_DAYS.last * DAY_MS) {
      out.push({
        event: "promo_expiring_2d",
        data: {},
        detail: `promo expires ${w.promoExpiresAt.toISOString()}`,
      });
    } else if (left > 0 && left <= PROMO_REMINDER_DAYS.first * DAY_MS) {
      out.push({
        event: "promo_expiring_7d",
        data: {},
        detail: `promo expires ${w.promoExpiresAt.toISOString()}`,
      });
    }
  }
  return out;
}

function contextOf(row: CandidateRow, w: CandidateWallet): NotifyContext {
  return {
    email: row.email,
    metadata: row.metadata,
    funded: w.funded,
    paidMicros: w.paidMicros,
    promoMicros: w.promoMicros,
    promoExpiresAt: w.promoExpiresAt,
    zeroBalanceAt: w.zeroBalanceAt,
    autoRechargeEnabled: w.autoRechargeEnabled,
    notified: w.notified,
    lastCreditAt: w.lastCreditAt,
    serverCount: row.serverCount,
  };
}

/** The first wallet notice that would actually be sent (same checks as notify). */
function walletDecision(row: CandidateRow, email: string, now: Date): NudgeDecision | null {
  const w = row.wallet;
  if (!w) return null;
  const ctx = contextOf(row, w);
  for (const c of walletCandidates(row, now)) {
    if (!MONEY_CRITICAL_EVENTS.has(c.event) && !emailNudgesEnabled(row.metadata)) continue;
    if (staleReason(c.event, ctx, now, c.data)) continue;
    const d = decideWalletNotification({
      notified: w.notified,
      event: c.event,
      key: notifyKey(c.event, c.data),
      ref: refFor(c.event, ctx, c.data),
      lastCreditAt: w.lastCreditAt,
      now,
    });
    if (!d.send) continue;
    return {
      userId: row.userId,
      email,
      kind: c.event,
      reason: c.event,
      detail: c.detail,
      data: c.data,
    };
  }
  return null;
}

function decideForRow(row: CandidateRow, now: Date): NudgeDecision | null {
  const email = (row.email ?? "").trim();
  if (!email || email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return null;
  return walletDecision(row, email, now) ?? activationDecision(row, email, now);
}

/**
 * The one decision per account. Pure: same rows + same clock, same output.
 * Money-critical notices lead, then the others, each group oldest account
 * first, so a capped run never starves the urgent ones.
 */
export function selectNudgeCandidates(
  rows: CandidateRow[],
  now: Date,
  opts: { walletOnly?: boolean } = {}
): NudgeDecision[] {
  const picked: Array<{ decision: NudgeDecision; critical: boolean; createdAt: number }> = [];
  for (const row of rows) {
    const decision = decideForRow(row, now);
    if (!decision) continue;
    if (opts.walletOnly && decision.kind === "activation") continue;
    picked.push({
      decision,
      critical: decision.kind !== "activation" && MONEY_CRITICAL_EVENTS.has(decision.kind),
      createdAt: row.createdAt.getTime(),
    });
  }
  picked.sort((a, b) => Number(b.critical) - Number(a.critical) || a.createdAt - b.createdAt);
  return picked.map((p) => p.decision);
}

type Db = ReturnType<typeof getDb>;

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Accounts with something to hear about: a wallet that is low, at zero, or
 * with free credit expiring within PROMO_REMINDER_DAYS.first; plus young
 * accounts with no first tool call yet (the activation reminder). Two
 * queries: users (with their wallet and counts), then usage per user over the
 * last 7 UTC days.
 */
export async function loadCandidateRows(db: Db, now: Date): Promise<CandidateRow[]> {
  const since = new Date(nextUtcMidnight(now).getTime() - 7 * DAY_MS);
  const nowIso = now.toISOString();
  const promoHorizon = new Date(now.getTime() + PROMO_REMINDER_DAYS.first * DAY_MS).toISOString();

  const serverCount = sql<number>`(select count(*) from ${servers} where ${servers.userId} = ${users.id} and ${servers.status} <> 'destroyed')::int`;
  // twinmcp-docs is auto-installed on every box server, so it is no activation
  // signal: only MCPs the user chose count.
  const mcpCount = sql<number>`(select count(*) from ${userServers} inner join ${servers} on ${servers.id} = ${userServers.serverId} inner join ${mcpServers} on ${mcpServers.id} = ${userServers.mcpServerId} where ${userServers.userId} = ${users.id} and ${servers.status} <> 'destroyed' and ${mcpServers.slug} <> ${TWINMCP_DOCS_SLUG})::int`;
  const livePromo = sql`(case when ${walletAccounts.promoExpiresAt} is null or ${walletAccounts.promoExpiresAt} > ${nowIso}::timestamptz then ${walletAccounts.promoMicros} else 0 end)`;
  const total = sql`(${walletAccounts.paidMicros} + ${livePromo})`;
  const walletDue = sql`(${walletAccounts.userId} is not null and (
    (${walletAccounts.promoMicros} > 0 and ${walletAccounts.promoExpiresAt} > ${nowIso}::timestamptz and ${walletAccounts.promoExpiresAt} <= ${promoHorizon}::timestamptz)
    or (${total} < ${LOW_BALANCE_MICROS} and (${total} > 0 or ${walletAccounts.zeroBalanceAt} is not null))
  ))`;

  const [userRows, usageRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        email: users.email,
        plan: users.plan,
        createdAt: users.createdAt,
        metadata: users.metadata,
        serverCount,
        mcpCount,
        hasWallet: sql<boolean>`(${walletAccounts.userId} is not null)`,
        paidMicros: walletAccounts.paidMicros,
        promoMicros: sql<string>`${livePromo}::text`,
        promoExpiresAt: walletAccounts.promoExpiresAt,
        fundedAt: walletAccounts.fundedAt,
        zeroBalanceAt: walletAccounts.zeroBalanceAt,
        autoRechargeEnabled: walletAccounts.autoRechargeEnabled,
        notified: walletAccounts.notified,
        lastCreditAt: sql<
          string | null
        >`(select max(cl.created_at)::text from credit_ledger cl where cl.user_id = ${users.id} and cl.delta_micros > 0)`,
      })
      .from(users)
      .leftJoin(walletAccounts, eq(walletAccounts.userId, users.id))
      .where(
        or(
          walletDue,
          and(
            gte(users.createdAt, new Date(now.getTime() - ACTIVATION_EMAIL_MAX_AGE_DAYS * DAY_MS)),
            sql`(${users.metadata}->>'firstToolCallAt') IS NULL`
          )
        )
      ),
    db
      .select({
        userId: userServers.userId,
        req: sql<number>`coalesce(sum(${usageMetrics.requestCount}),0)::int`,
      })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(gte(usageMetrics.periodStart, since))
      .groupBy(userServers.userId),
  ]);

  const usage = new Map<string, number>();
  for (const r of usageRows) usage.set(r.userId, Number(r.req) || 0);

  return userRows.map((u) => ({
    userId: u.userId,
    email: u.email,
    plan: u.plan,
    createdAt: u.createdAt,
    metadata: u.metadata ?? {},
    serverCount: Number(u.serverCount) || 0,
    mcpCount: Number(u.mcpCount) || 0,
    requests7d: usage.get(u.userId) ?? 0,
    wallet: u.hasWallet
      ? {
          paidMicros: Number(u.paidMicros ?? 0),
          promoMicros: Number(u.promoMicros ?? 0),
          promoExpiresAt: toDate(u.promoExpiresAt),
          funded: Boolean(u.fundedAt) || u.plan === "pro" || u.plan === "team",
          zeroBalanceAt: toDate(u.zeroBalanceAt),
          autoRechargeEnabled: Boolean(u.autoRechargeEnabled),
          notified: u.notified ?? {},
          lastCreditAt: toDate(u.lastCreditAt),
        }
      : null,
  }));
}

export interface RunNudgesOptions {
  /** Compute the decisions, send nothing, stamp nothing. */
  dryRun?: boolean;
  /** Max emails per run (money-critical first). */
  limit?: number;
  now?: Date;
}

export interface RunNudgesResult {
  /** Accounts examined. */
  scanned: number;
  /** What was (or, in dry-run, would be) sent — already capped at `limit`. */
  decisions: NudgeDecision[];
  sent: number;
  errors: number;
  /** Wallet notices notify() dropped on fresh data (deduped, stale, opted out, ...). */
  dropped: number;
  /** Set when nothing could go out at all (no Resend key). */
  skipped?: "no_resend_key";
}

async function run(opts: RunNudgesOptions & { walletOnly: boolean }): Promise<RunNudgesResult> {
  const { dryRun = false, limit = 200, now = new Date(), walletOnly } = opts;
  const db = getDb();
  const rows = await loadCandidateRows(db, now);
  const decisions = selectNudgeCandidates(rows, now, { walletOnly }).slice(0, Math.max(0, limit));
  const result: RunNudgesResult = {
    scanned: rows.length,
    decisions,
    sent: 0,
    errors: 0,
    dropped: 0,
  };
  if (dryRun || decisions.length === 0) return result;

  // The senders throw without a key; one warning beats N Sentry events a day.
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[nudges] RESEND_API_KEY not set — ${decisions.length} email(s) not sent`);
    return { ...result, skipped: "no_resend_key" };
  }

  const byId = new Map(rows.map((r) => [r.userId, r]));
  for (const decision of decisions) {
    const row = byId.get(decision.userId);
    if (!row) continue;
    if (decision.kind !== "activation") {
      // notify re-reads the account, re-checks and dedupes atomically.
      const outcome: NotifyOutcome = await notifyWalletStateWithOutcome(
        decision.userId,
        decision.kind,
        decision.data,
        now
      );
      if (outcome === "sent") result.sent += 1;
      else if (outcome === "failed") result.errors += 1;
      else result.dropped += 1;
      continue;
    }
    try {
      await sendActivationEmail(decision.email);
      await stampNudge(db, row.userId, row.metadata, "activation", now);
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
      console.warn(`[nudges] activation email for user ${decision.userId} failed:`, err);
      Sentry.captureException(err, {
        tags: { area: "upgrade-nudge", stage: "job" },
        extra: { userId: decision.userId, kind: decision.kind },
      });
    }
  }
  return result;
}

/** Wallet reminders only (promo expiring 7d/2d, low/zero catch-up, runtime deletion). */
export function runWalletReminders(opts: RunNudgesOptions = {}): Promise<RunNudgesResult> {
  return run({ ...opts, walletOnly: true });
}

/**
 * Every lifecycle email: wallet reminders plus the activation reminder. The
 * name predates the wallet; /api/cron/nudges and the "upgrade-nudges" QStash
 * job call it.
 */
export function runUpgradeNudges(opts: RunNudgesOptions = {}): Promise<RunNudgesResult> {
  return run({ ...opts, walletOnly: false });
}
