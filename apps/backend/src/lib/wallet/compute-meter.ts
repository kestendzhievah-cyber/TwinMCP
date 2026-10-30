import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { auditLogs, servers, type BoxSize } from "@/db/schema/platform";
import { users } from "@/db/schema/core";
import { boxUsageSnapshots, creditLedger, walletAccounts } from "@/db/schema/wallet";
import { getBoxClient, isStubMode, type BoxUsage } from "@/lib/upstash/box-client";
import {
  PRICING,
  UPSTASH_CORE_HOUR_USD,
  eurToMicros,
  priceComputeMicros,
  type Pricing,
} from "@/lib/wallet/pricing";
import { debit, hasCredit } from "@/lib/wallet/ledger";
import { afterBalanceChange } from "@/lib/wallet/after-debit";
import { isFundedAccount } from "@/lib/plan-features";

// Compute metering and wallet enforcement (contract W1 compute side).
//
// Upstash bills TwinMCP per active CPU-hour and reports lifetime counters per
// box (Box.list(): total_compute_cost_usd, total_cpu_ns, last_activity_at).
// Every 5 minutes the meter diffs those counters against the last snapshot in
// box_usage_snapshots and debits the user's wallet (kind 'usage_compute').
// A deleted box loses its counters, so provisioning meters it right before
// every deleteBox (meterBoxBeforeDelete).
//
// box_usage_snapshots.total_cost_usd means "USD already billed for this box".
// With real counters it equals the last counter seen; in the wall-clock
// fallback it accumulates the estimates. Either way the charge for a sample is
// price(newTotal) - price(oldTotal), so rounding never drifts and a counter
// that later reappears is only billed above what was already estimated.
//
// The file has two halves: PURE decisions (tested in compute-meter.test.ts)
// and the DB / box-API executors that apply them.

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Nanoseconds of CPU time in one CPU-hour. */
export const CPU_NS_PER_HOUR = 3_600 * 1e9;

/**
 * Wall-clock fallback, used only when Upstash returns neither cost nor CPU
 * counters: estimated USD per hour a box is awake, by size. 10% of the box's
 * list price per active CPU-hour. That is above the 0.5-3% of one core an idle
 * MCP bridge measured in the research dossier, so the estimate errs toward
 * covering TwinMCP's real cost. Rows billed this way carry units.estimated=true.
 */
export const WALLCLOCK_USD_PER_AWAKE_HOUR: Readonly<Record<BoxSize, number>> = {
  small: 0.01,
  medium: 0.02,
  large: 0.04,
};

/**
 * Longest window one wall-clock sample may bill. Pay-as-you-go boxes freeze
 * after 6 h idle, and a meter that was down for longer must not turn into one
 * huge estimated charge.
 */
export const WALLCLOCK_MAX_WINDOW_MS = 6 * MS_PER_HOUR;

/** Box statuses during which a box can use CPU (Upstash: creating|idle|running|paused|error|deleted). */
const AWAKE_STATUSES = new Set(["running", "idle", "creating"]);

/** Metering older than this is reported as a blocker by /api/health. */
export const METER_STALE_MS = 15 * 60_000;

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// PURE: metering decision
// ---------------------------------------------------------------------------

export interface UsageSnapshot {
  /** USD already billed for this box. */
  totalCostUsd: number;
  totalCpuNs: number;
  sampledAt: Date;
}

export type MeterSource =
  /** Upstash's own cost counter (preferred). */
  | "cost"
  /** CPU counter priced at the Upstash list rate for the box size. */
  | "cpu"
  /** No counters: wall-clock estimate from status / last_activity_at. */
  | "wallclock"
  /**
   * First sight of a box with no snapshot that predates metering (created
   * before the wallet release / migration 0020): record the counters, bill
   * nothing. Newer boxes are never baselined (see billsFromZero).
   */
  | "baseline";

export interface MeterDecision {
  source: MeterSource;
  /** True only for the wall-clock fallback. */
  estimated: boolean;
  /** USD newly billed by this sample (real or estimated). */
  deltaUsd: number;
  /** Wallet debit, micro-euros: price(next total) - price(previous total). */
  amountMicros: number;
  /** Snapshot to store. */
  next: { totalCostUsd: number; totalCpuNs: number };
  /** Wall-clock fallback only: seconds counted as awake. */
  awakeSeconds?: number;
  /** CPU nanoseconds used since the previous snapshot, when the CPU counter is present. */
  cpuNsDelta?: number;
}

export interface MeterInput {
  snapshot: UsageSnapshot | null;
  usage: Pick<BoxUsage, "totalCpuNs" | "totalComputeCostUsd" | "lastActivityAt" | "status"> & {
    createdAt?: Date | null;
  };
  size: BoxSize;
  now: Date;
  /**
   * No snapshot, but the box was created after metering started (see
   * billsFromZero): its zero snapshot write failed, so bill it from zero
   * (as if the snapshot were 0 / 0 at the box's creation) instead of
   * baselining it for free.
   */
  billFromZero?: boolean;
  pricing?: Pricing;
}

/**
 * Process start, the default "metering started" instant: every box this
 * process creates is created by provisionServer, which writes a zero snapshot
 * first (single container). Computed from uptime, not module load, so a box
 * created before this module is first imported still counts.
 */
const PROCESS_STARTED_AT = new Date(
  Date.now() -
    Math.round((typeof process !== "undefined" && process.uptime ? process.uptime() : 0) * 1000)
);

/**
 * The instant after which every box TwinMCP creates has a zero snapshot at
 * creation: WALLET_METERING_SINCE (ISO date; set it to the time the wallet
 * release went live to cover later restarts), else this process's start.
 * Never set it earlier than the wallet release: a pre-wallet box would then be
 * billed for its whole lifetime.
 */
export function meteringSince(
  env: Record<string, string | undefined> = process.env,
  processStartedAt: Date = PROCESS_STARTED_AT
): Date {
  const raw = env.WALLET_METERING_SINCE?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return processStartedAt;
}

/**
 * Whether a box with NO snapshot is billed from zero (true) or baselined at
 * its current counters (false). Boxes created before metering started (before
 * migration 0020 / the wallet release) have no snapshot by design: they are
 * baselined, so compute they used under the old subscription is never billed.
 * A box created after it should have had a zero snapshot; a missing one means
 * that write failed, and baselining it would make its first sample free.
 * Unknown creation time → baseline (never bill what may predate metering).
 */
export function billsFromZero(createdAt: Date | null | undefined, since: Date): boolean {
  return !!createdAt && createdAt.getTime() >= since.getTime();
}

/**
 * Seconds a box without usage counters is assumed awake between the previous
 * sample and now: the whole window while its status says it can run, else up
 * to its last recorded activity. Window capped at WALLCLOCK_MAX_WINDOW_MS.
 */
export function awakeSecondsSince(
  from: Date,
  now: Date,
  status: string,
  lastActivityAt: Date | null
): number {
  const windowMs = Math.min(Math.max(0, now.getTime() - from.getTime()), WALLCLOCK_MAX_WINDOW_MS);
  if (windowMs === 0) return 0;
  if (AWAKE_STATUSES.has(status)) return windowMs / 1000;
  if (lastActivityAt && lastActivityAt.getTime() > from.getTime()) {
    const activeMs = Math.min(lastActivityAt.getTime(), now.getTime()) - from.getTime();
    return Math.min(Math.max(0, activeMs), windowMs) / 1000;
  }
  return 0;
}

export function decideMeter({
  snapshot: stored,
  usage,
  size,
  now,
  billFromZero = false,
  pricing = PRICING,
}: MeterInput): MeterDecision {
  // A box created by provisionServer gets a zero snapshot at creation, so it
  // is billed from its first CPU second. Without one, a box created after
  // metering started is billed from zero too (its snapshot write failed); a
  // box older than metering starts at its current counters (baseline).
  const snapshot: UsageSnapshot | null =
    stored ??
    (billFromZero ? { totalCostUsd: 0, totalCpuNs: 0, sampledAt: usage.createdAt ?? now } : null);
  if (!snapshot) {
    return {
      source: "baseline",
      estimated: false,
      deltaUsd: 0,
      amountMicros: 0,
      next: {
        totalCostUsd: round6(usage.totalComputeCostUsd ?? 0),
        totalCpuNs: Math.round(usage.totalCpuNs ?? 0),
      },
    };
  }

  const prev = snapshot.totalCostUsd;
  let billed: number;
  let source: MeterSource;
  let cpuNs = snapshot.totalCpuNs;
  let cpuNsDelta: number | undefined;
  let awakeSeconds: number | undefined;

  if (usage.totalCpuNs != null) {
    cpuNsDelta = Math.max(0, usage.totalCpuNs - snapshot.totalCpuNs);
    cpuNs = Math.max(snapshot.totalCpuNs, Math.round(usage.totalCpuNs));
  }

  if (usage.totalComputeCostUsd != null) {
    source = "cost";
    // delta = max(0, current - snapshot): never refund, never bill twice.
    billed = Math.max(prev, round6(usage.totalComputeCostUsd));
  } else if (cpuNsDelta != null) {
    source = "cpu";
    // CPU time alone: billed at the confirmed per-core (small) rate for every
    // size, never above it (UPSTASH_CPU_HOUR_USD: medium/large unit unconfirmed).
    billed = round6(prev + (cpuNsDelta / CPU_NS_PER_HOUR) * UPSTASH_CORE_HOUR_USD);
  } else {
    source = "wallclock";
    awakeSeconds = awakeSecondsSince(snapshot.sampledAt, now, usage.status, usage.lastActivityAt);
    billed = round6(prev + (awakeSeconds / 3600) * WALLCLOCK_USD_PER_AWAKE_HOUR[size]);
  }

  const amountMicros = Math.max(
    0,
    priceComputeMicros(billed, pricing) - priceComputeMicros(prev, pricing)
  );
  return {
    source,
    estimated: source === "wallclock",
    deltaUsd: round6(billed - prev),
    amountMicros,
    next: { totalCostUsd: billed, totalCpuNs: cpuNs },
    ...(awakeSeconds != null ? { awakeSeconds } : {}),
    ...(cpuNsDelta != null ? { cpuNsDelta } : {}),
  };
}

// ---------------------------------------------------------------------------
// PURE: wallet enforcement decision
// ---------------------------------------------------------------------------

export type DeletionStage = "day0" | "day7" | "day13";
const STAGE_DAYS: ReadonlyArray<[DeletionStage, number]> = [
  ["day13", 13],
  ["day7", 7],
  ["day0", 0],
];
/** The day number of a stage ("day7" → 7), as lib/wallet/notify.ts keys it. */
export function stageDays(stage: DeletionStage): number {
  return STAGE_DAYS.find(([s]) => s === stage)?.[1] ?? 0;
}

/** A promo-only runtime is deleted on day 14 of an empty balance with an expired promo. */
export const RUNTIME_DELETION_DAY = 14;
/** The last warning must be at least this old before the runtime is deleted. */
export const MIN_WARNING_LEAD_MS = 20 * MS_PER_HOUR;

/** wallet_accounts.notified keys written by the enforcement cron. */
export const NOTIFIED_KEYS = {
  killSwitch: "promo_kill_switch",
  runtimeDeleted: "runtime_deleted",
  deletionWarning: (stage: DeletionStage) => `runtime_deletion_${stage}`,
} as const;

export interface KillSwitchFlag {
  reason: "daily" | "total";
  at: string;
  /** UTC day (YYYY-MM-DD) the flag was raised; a daily flag lifts the next day. */
  day: string;
  costEur: number;
}

/** A stamp in `notified`, tied to one zero-balance cycle so a new cycle starts clean. */
export interface CycleStamp {
  at: string;
  cycle: string;
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Does this stored kill-switch flag still block compute? Funded accounts are never blocked by it. */
export function killSwitchActive(flag: unknown, now: Date, funded: boolean): boolean {
  if (funded || !isRecord(flag)) return false;
  if (flag.reason === "total") return true;
  return flag.reason === "daily" && flag.day === utcDay(now);
}

/** Total spendable balance: paid plus promo while unexpired (same rule as ledger.getWallet). */
export function effectiveTotalMicros(
  w: { paidMicros: number; promoMicros: number; promoExpiresAt: Date | null } | null,
  now: Date
): number {
  if (!w) return 0;
  const promoLive = !w.promoExpiresAt || w.promoExpiresAt.getTime() > now.getTime();
  return w.paidMicros + (promoLive ? w.promoMicros : 0);
}

/**
 * A user is "funded" once they paid: wallet funded_at (first paid top-up or a
 * subscription conversion), or a legacy subscription still being paid. It is
 * NEVER derived from users.plan: billing no longer downgrades plans, so a
 * lapsed or converted trial can keep plan='pro' without ever having paid.
 * Funded accounts are paused at zero but their runtimes are NEVER deleted and
 * the promo kill switch never applies to them.
 */
export function isFunded(fundedAt: Date | null, subscriptionStatus?: string | null): boolean {
  // One rule for every surface: lib/plan-features.ts isFundedAccount.
  return isFundedAccount(fundedAt, subscriptionStatus);
}

export interface EnforceInput {
  now: Date;
  totalMicros: number;
  funded: boolean;
  promoExpiresAt: Date | null;
  zeroBalanceAt: Date | null;
  notified: Record<string, unknown>;
  /** Servers whose box is up (status running, box id set). */
  activeServerIds: string[];
  /** Every server that still has a box (running or paused). */
  runtimeServerIds: string[];
  /** Real compute cost billed today (UTC) / ever, USD. */
  computeCostTodayUsd: number;
  computeCostTotalUsd: number;
  /**
   * A legacy subscription still being paid (active / past_due) that the
   * owner's conversion script has not converted yet: its wallet is usually
   * empty, but the period is paid, so it is never paused for "no credit".
   */
  payingSubscription?: boolean;
  pricing?: Pricing;
}

export interface EnforceDecision {
  pauseServerIds: string[];
  pauseReason: "no_credit" | "promo_daily_cap" | "promo_total_cap" | null;
  /** undefined = leave as is, Date = set when not set, null = clear. */
  zeroBalanceAt: Date | null | undefined;
  /** A new kill-switch flag to store and audit (null when none or already stored). */
  newKillSwitch: KillSwitchFlag | null;
  /** Deletion warning to send now (and stamp). */
  warning: DeletionStage | null;
  /** The deletion cycle id (zero-balance start, ISO) the warning / deletion belongs to. */
  cycle: string | null;
  /** Day the runtimes are deleted (for the warning email). */
  deleteAt: Date | null;
  deleteRuntimeServerIds: string[];
}

function stampFor(
  notified: Record<string, unknown>,
  key: string,
  cycle: string
): CycleStamp | null {
  const v = notified[key];
  if (!isRecord(v) || v.cycle !== cycle || typeof v.at !== "string") return null;
  return { at: v.at, cycle: v.cycle };
}

/**
 * What the wallet-enforce cron does for one user:
 *  - balance <= 0 → pause every running box (any account; funded ones too).
 *  - promo-only account whose real compute cost passed the promo caps → kill
 *    switch: pause + flag (daily cap lifts at UTC midnight, total cap when funded).
 *  - promo-only account, promo expired, balance <= 0 → warn on day 0, 7 and 13,
 *    delete runtimes (boxes only; server rows and configs are kept) on day 14.
 *    Funded accounts are never in this branch.
 */
export function decideEnforcement(input: EnforceInput): EnforceDecision {
  const { now, funded, notified } = input;
  const pricing = input.pricing ?? PRICING;
  const noCredit = input.totalMicros <= 0;

  const decision: EnforceDecision = {
    pauseServerIds: [],
    pauseReason: null,
    zeroBalanceAt: undefined,
    newKillSwitch: null,
    warning: null,
    cycle: null,
    deleteAt: null,
    deleteRuntimeServerIds: [],
  };

  if (noCredit && !input.zeroBalanceAt) decision.zeroBalanceAt = now;
  if (!noCredit && input.zeroBalanceAt) decision.zeroBalanceAt = null;

  // Promo kill switch (promo-only accounts).
  let killed = killSwitchActive(notified[NOTIFIED_KEYS.killSwitch], now, funded);
  let killReason: "daily" | "total" | null = killed
    ? (notified[NOTIFIED_KEYS.killSwitch] as KillSwitchFlag).reason
    : null;
  if (!funded) {
    const todayEur = input.computeCostTodayUsd * pricing.usdToEur;
    const totalEur = input.computeCostTotalUsd * pricing.usdToEur;
    const reason =
      totalEur > pricing.promoTotalCostCapEur
        ? "total"
        : todayEur > pricing.promoDailyCostCapEur
          ? "daily"
          : null;
    // Raise (or escalate daily → total) only when not already stored.
    if (reason && (!killed || (reason === "total" && killReason === "daily"))) {
      decision.newKillSwitch = {
        reason,
        at: now.toISOString(),
        day: utcDay(now),
        costEur: round6(reason === "total" ? totalEur : todayEur),
      };
      killed = true;
      killReason = reason;
    }
  }

  if (noCredit && !input.payingSubscription) {
    decision.pauseServerIds = [...input.activeServerIds];
    decision.pauseReason = "no_credit";
  } else if (killed) {
    decision.pauseServerIds = [...input.activeServerIds];
    decision.pauseReason = killReason === "total" ? "promo_total_cap" : "promo_daily_cap";
  }
  if (decision.pauseServerIds.length === 0) decision.pauseReason = null;

  // Deletion countdown: promo-only, promo expired, empty balance, a runtime left.
  const promoExpired = !input.promoExpiresAt || input.promoExpiresAt.getTime() <= now.getTime();
  if (funded || !noCredit || !promoExpired || input.runtimeServerIds.length === 0) {
    return decision;
  }
  const zeroAt = input.zeroBalanceAt ?? now;
  const start = new Date(Math.max(zeroAt.getTime(), input.promoExpiresAt?.getTime() ?? 0));
  const cycle = start.toISOString();
  decision.cycle = cycle;
  decision.deleteAt = new Date(start.getTime() + RUNTIME_DELETION_DAY * MS_PER_DAY);
  const day = Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY);

  if (stampFor(notified, NOTIFIED_KEYS.runtimeDeleted, cycle)) return decision;

  // Highest stage due; a stage counts as sent when it or a later one was
  // stamped this cycle (after a cron outage only the latest warning goes out).
  const dueIdx = STAGE_DAYS.findIndex(([, d]) => day >= d);
  const idx = dueIdx === -1 ? STAGE_DAYS.length - 1 : dueIdx;
  const sent = STAGE_DAYS.slice(0, idx + 1).some(([stage]) =>
    stampFor(notified, NOTIFIED_KEYS.deletionWarning(stage), cycle)
  );
  if (!sent) {
    const due = STAGE_DAYS[idx][0];
    decision.warning = due;
    return decision; // never delete in the same tick as a warning
  }

  if (day >= RUNTIME_DELETION_DAY) {
    const last = stampFor(notified, NOTIFIED_KEYS.deletionWarning("day13"), cycle);
    if (!last) {
      decision.warning = "day13";
      return decision;
    }
    if (now.getTime() - new Date(last.at).getTime() >= MIN_WARNING_LEAD_MS) {
      decision.deleteRuntimeServerIds = [...input.runtimeServerIds];
    }
  }
  return decision;
}

// ---------------------------------------------------------------------------
// DB: snapshots and metering
// ---------------------------------------------------------------------------

export interface MeterTarget {
  boxId: string;
  serverId: string | null;
  userId: string | null;
  size: BoxSize;
}

interface MeterOutcome {
  boxId: string;
  source: MeterSource;
  amountMicros: number;
  charged: boolean;
  skipped?: "lost_race" | "no_user";
  /** The owner's balance is at or below zero after this sample. */
  atZero?: boolean;
}

/** In-process record of the last full meter run, for /api/health. */
let lastRun: {
  at: Date;
  costFieldsPresent: boolean | null;
  boxes: number;
  charged: number;
  errors: number;
} | null = null;

export function lastMeterRun(): typeof lastRun {
  return lastRun;
}

/** Latest snapshot write (any box), from the DB: survives restarts. Null on error / none. */
export async function lastSnapshotAt(): Promise<Date | null> {
  try {
    const [row] = await getDb()
      .select({ at: sql<string | null>`max(${boxUsageSnapshots.sampledAt})` })
      .from(boxUsageSnapshots);
    return row?.at ? new Date(row.at) : null;
  } catch {
    return null;
  }
}

/**
 * Record a zero snapshot for a box provisioning just created, so the meter
 * bills it from its first CPU second instead of treating it as a baseline.
 * Retried (a missing snapshot makes the first sample free); never throws.
 */
export async function ensureZeroSnapshot(
  boxId: string,
  serverId: string | null,
  userId: string | null,
  now: Date = new Date(),
  attempts = 3
): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await getDb()
        .insert(boxUsageSnapshots)
        .values({ boxId, serverId, userId, totalCostUsd: "0", totalCpuNs: 0, sampledAt: now })
        .onConflictDoNothing({ target: boxUsageSnapshots.boxId });
      return;
    } catch (err) {
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 250 * i));
        continue;
      }
      console.error(`[meter] zero snapshot for ${boxId} failed:`, err);
      Sentry.captureException(err, { tags: { area: "wallet", stage: "zero-snapshot" } });
    }
  }
}

async function readSnapshots(boxIds: string[]): Promise<Map<string, UsageSnapshot>> {
  const out = new Map<string, UsageSnapshot>();
  if (boxIds.length === 0) return out;
  const rows = await getDb()
    .select()
    .from(boxUsageSnapshots)
    .where(inArray(boxUsageSnapshots.boxId, boxIds));
  for (const r of rows) {
    out.set(r.boxId, {
      totalCostUsd: Number(r.totalCostUsd) || 0,
      totalCpuNs: Number(r.totalCpuNs) || 0,
      sampledAt: r.sampledAt,
    });
  }
  return out;
}

/** Thrown inside the debit transaction when another meter already claimed the sample. */
class LostRace extends Error {}

/**
 * Meter one box: decide, then claim the sample with a compare-and-swap on the
 * snapshot's sampled_at (so two concurrent meters never bill the same
 * interval) and debit, in ONE transaction: both commit or neither does, so a
 * crash between them can neither lose nor double-bill an interval. The debit
 * stops at the published overdraft floor; usage beyond it is written off.
 */
async function meterOne(
  target: MeterTarget,
  usage: BoxUsage,
  snapshot: UsageSnapshot | null,
  now: Date
): Promise<MeterOutcome> {
  const db = getDb();
  const billFromZero = !snapshot && billsFromZero(usage.createdAt, meteringSince());
  const d = decideMeter({ snapshot, usage, size: target.size, now, billFromZero });
  const values = {
    totalCostUsd: d.next.totalCostUsd.toFixed(6),
    totalCpuNs: d.next.totalCpuNs,
    sampledAt: now,
    ...(target.serverId ? { serverId: target.serverId } : {}),
    ...(target.userId ? { userId: target.userId } : {}),
  };
  // Runs on the pool or inside the debit's transaction.
  const claim = async (exec: Pick<typeof db, "insert" | "update">): Promise<boolean> => {
    const won = !snapshot
      ? await exec
          .insert(boxUsageSnapshots)
          .values({ boxId: target.boxId, ...values })
          .onConflictDoNothing({ target: boxUsageSnapshots.boxId })
          .returning({ id: boxUsageSnapshots.boxId })
      : await exec
          .update(boxUsageSnapshots)
          .set(values)
          .where(
            and(
              eq(boxUsageSnapshots.boxId, target.boxId),
              // Millisecond compare: JS Dates carry ms, Postgres keeps µs.
              sql`date_trunc('milliseconds', ${boxUsageSnapshots.sampledAt}) = ${snapshot.sampledAt.toISOString()}::timestamptz`
            )
          )
          .returning({ id: boxUsageSnapshots.boxId });
    return won.length > 0;
  };
  const lost: MeterOutcome = {
    boxId: target.boxId,
    source: d.source,
    amountMicros: 0,
    charged: false,
    skipped: "lost_race",
  };

  if (d.amountMicros <= 0 || !target.userId) {
    if (!(await claim(db))) return lost;
    if (d.amountMicros <= 0) {
      return { boxId: target.boxId, source: d.source, amountMicros: 0, charged: false };
    }
    console.warn(`[meter] box ${target.boxId} used compute but has no owner to bill`);
    return {
      boxId: target.boxId,
      source: d.source,
      amountMicros: d.amountMicros,
      charged: false,
      skipped: "no_user",
    };
  }

  let res;
  try {
    res = await debit(
      {
        userId: target.userId,
        amountMicros: d.amountMicros,
        kind: "usage_compute",
        idempotencyKey: `compute:${target.boxId}:${now.toISOString()}`,
        floorMicros: overdraftMicros(),
        units: {
          boxId: target.boxId,
          serverId: target.serverId,
          size: target.size,
          source: d.source,
          estimated: d.estimated,
          deltaUsd: d.deltaUsd,
          ...(d.cpuNsDelta != null ? { cpuNs: d.cpuNsDelta } : {}),
          ...(d.awakeSeconds != null ? { awakeSeconds: Math.round(d.awakeSeconds) } : {}),
          from:
            snapshot?.sampledAt.toISOString() ??
            (billFromZero ? (usage.createdAt?.toISOString() ?? null) : null),
          ...(billFromZero ? { missingSnapshot: true } : {}),
          to: now.toISOString(),
        },
        note: d.estimated ? "Compute (estimated from wall-clock time)" : "Compute",
      },
      {
        pre: async (tx) => {
          if (!(await claim(tx))) throw new LostRace();
        },
      }
    );
  } catch (err) {
    if (err instanceof LostRace) return lost;
    throw err;
  }
  if (res.writtenOffMicros) {
    console.warn(
      `[meter] box ${target.boxId}: ${res.writtenOffMicros} µ€ of compute written off at the overdraft floor (user ${target.userId})`
    );
  }
  // Auto-recharge / low and zero balance emails when a line was crossed.
  if (res.applied) afterBalanceChange(target.userId, { ...res, kind: "usage_compute" });
  const charged = res.applied ? d.amountMicros - (res.writtenOffMicros ?? 0) : 0;
  return {
    boxId: target.boxId,
    source: d.source,
    amountMicros: charged,
    charged: charged > 0,
    atZero: res.totalMicros <= 0,
  };
}

async function runBounded<T>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
}

export interface MeterRunResult {
  ok: boolean;
  skipped?: "stub";
  boxes: number;
  metered: number;
  charged: number;
  chargedMicros: number;
  unattributed: number;
  errors: number;
  costFieldsPresent: boolean | null;
  sources: Record<MeterSource, number>;
}

/**
 * Meter every box of the Upstash account (cron, every 5 minutes). Boxes are
 * attributed through servers.box_id, or through an existing snapshot for a
 * box whose server row is gone. Never throws per box: one failure is logged
 * and the rest still run.
 */
export async function runMeterBoxes(now: Date = new Date()): Promise<MeterRunResult> {
  const sources: Record<MeterSource, number> = { cost: 0, cpu: 0, wallclock: 0, baseline: 0 };
  const result: MeterRunResult = {
    ok: true,
    boxes: 0,
    metered: 0,
    charged: 0,
    chargedMicros: 0,
    unattributed: 0,
    errors: 0,
    costFieldsPresent: null,
    sources,
  };
  if (isStubMode()) return { ...result, skipped: "stub" };

  const usages = await getBoxClient().list();
  result.boxes = usages.length;
  result.costFieldsPresent =
    usages.length === 0
      ? (lastRun?.costFieldsPresent ?? null)
      : usages.some((u) => u.totalComputeCostUsd != null);

  const ids = usages.map((u) => u.id);
  const db = getDb();
  const owners = new Map<string, MeterTarget>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = await db
      .select({
        id: servers.id,
        userId: servers.userId,
        boxId: servers.boxId,
        size: servers.boxSize,
      })
      .from(servers)
      .where(inArray(servers.boxId, chunk));
    for (const r of rows) {
      if (r.boxId)
        owners.set(r.boxId, { boxId: r.boxId, serverId: r.id, userId: r.userId, size: r.size });
    }
  }
  const snapshots = await readSnapshotsChunked(ids);
  const snapOwners = await snapshotOwners(ids.filter((id) => !owners.has(id)));

  const emptied = new Set<string>();
  await runBounded(usages, 5, async (u) => {
    const target =
      owners.get(u.id) ??
      (snapOwners.get(u.id)
        ? { boxId: u.id, ...snapOwners.get(u.id)!, size: u.size ?? "small" }
        : null);
    if (!target) {
      result.unattributed++;
      return;
    }
    try {
      const out = await meterOne(target, u, snapshots.get(u.id) ?? null, now);
      if (out.skipped === "lost_race") return;
      if (out.atZero && target.userId) emptied.add(target.userId);
      result.metered++;
      sources[out.source]++;
      if (out.charged) {
        result.charged++;
        result.chargedMicros += out.amountMicros;
      }
    } catch (err) {
      result.errors++;
      console.error(`[meter] box ${u.id} failed:`, err);
      Sentry.captureException(err, {
        tags: { area: "wallet", stage: "meter" },
        extra: { boxId: u.id },
      });
    }
  });

  // A wallet that just reached zero: pause its boxes now rather than at the
  // next wallet-enforce tick, so usage stays within the overdraft.
  if (emptied.size > 0) {
    try {
      const { enqueue } = await import("@/lib/queue/qstash");
      await enqueue({ type: "wallet-enforce" });
    } catch (err) {
      console.error("[meter] could not queue wallet-enforce:", err);
    }
  }

  result.ok = result.errors === 0;
  lastRun = {
    at: now,
    costFieldsPresent: result.costFieldsPresent,
    boxes: result.boxes,
    charged: result.charged,
    errors: result.errors,
  };
  return result;
}

async function readSnapshotsChunked(ids: string[]): Promise<Map<string, UsageSnapshot>> {
  const out = new Map<string, UsageSnapshot>();
  for (let i = 0; i < ids.length; i += 500) {
    for (const [k, v] of await readSnapshots(ids.slice(i, i + 500))) out.set(k, v);
  }
  return out;
}

async function snapshotOwners(
  ids: string[]
): Promise<Map<string, { serverId: string | null; userId: string | null }>> {
  const out = new Map<string, { serverId: string | null; userId: string | null }>();
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await getDb()
      .select({
        boxId: boxUsageSnapshots.boxId,
        serverId: boxUsageSnapshots.serverId,
        userId: boxUsageSnapshots.userId,
      })
      .from(boxUsageSnapshots)
      .where(
        and(
          inArray(boxUsageSnapshots.boxId, ids.slice(i, i + 500)),
          isNotNull(boxUsageSnapshots.userId)
        )
      );
    for (const r of rows) out.set(r.boxId, { serverId: r.serverId, userId: r.userId });
  }
  return out;
}

const BEFORE_DELETE_TIMEOUT_MS = 8_000;

/**
 * Bill a box's last usage right before it is deleted (its counters die with
 * it). Bounded so a slow box API cannot hold a delete; never throws.
 */
export async function meterBoxBeforeDelete(
  boxId: string,
  ctx?: { serverId: string | null; userId: string | null; size: BoxSize }
): Promise<void> {
  if (isStubMode()) return;
  const work = async () => {
    const usage = await getBoxClient().usage(boxId);
    if (!usage) return; // already gone upstream: nothing left to read
    let target: MeterTarget | null = ctx ? { boxId, ...ctx } : null;
    if (!target) {
      const [row] = await getDb()
        .select({ id: servers.id, userId: servers.userId, size: servers.boxSize })
        .from(servers)
        .where(eq(servers.boxId, boxId))
        .limit(1);
      target = row
        ? { boxId, serverId: row.id, userId: row.userId, size: row.size }
        : { boxId, serverId: null, userId: null, size: usage.size ?? "small" };
    }
    const snaps = await readSnapshots([boxId]);
    await meterOne(target, usage, snaps.get(boxId) ?? null, new Date());
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("meter before delete timed out")),
          BEFORE_DELETE_TIMEOUT_MS
        );
      }),
    ]);
  } catch (err) {
    console.error(`[meter] final sample for box ${boxId} failed:`, err);
    Sentry.captureException(err, {
      tags: { area: "wallet", stage: "meter-before-delete" },
      extra: { boxId },
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// DB: compute gate (provisioning) and enforcement (cron)
// ---------------------------------------------------------------------------

export type ComputeBlock = "no_credit" | "promo_cost_cap";

/**
 * May this user start or wake compute right now? Null = yes. Fails closed: a
 * DB error reads as "no_credit" (hasCredit already fails closed).
 */
export async function checkComputeAllowed(
  userId: string,
  now: Date = new Date()
): Promise<ComputeBlock | null> {
  if (!(await hasCredit(userId))) return "no_credit";
  try {
    const [row] = await getDb()
      .select({
        fundedAt: walletAccounts.fundedAt,
        notified: walletAccounts.notified,
        subscriptionStatus: users.subscriptionStatus,
      })
      .from(users)
      .leftJoin(walletAccounts, eq(walletAccounts.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return "no_credit";
    const funded = isFunded(row.fundedAt ?? null, row.subscriptionStatus);
    return killSwitchActive(row.notified?.[NOTIFIED_KEYS.killSwitch], now, funded)
      ? "promo_cost_cap"
      : null;
  } catch (err) {
    console.error(`[wallet] compute gate read failed for ${userId}:`, err);
    return "no_credit";
  }
}

function writeAudit(
  userId: string,
  action: string,
  targetId: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  return getDb()
    .insert(auditLogs)
    .values({
      id: randomUUID(),
      userId,
      action,
      targetType: targetId ? "server" : "user",
      targetId,
      metadata,
    })
    .then(
      () => undefined,
      (err: unknown) => console.error(`[wallet] audit ${action} failed:`, err)
    );
}

async function setNotifiedKey(userId: string, key: string, value: unknown): Promise<void> {
  await getDb()
    .update(walletAccounts)
    .set({
      notified: sql`coalesce(${walletAccounts.notified}, '{}'::jsonb) || jsonb_build_object(${key}::text, ${JSON.stringify(value)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(eq(walletAccounts.userId, userId));
}

export interface EnforceUserReport {
  userId: string;
  totalMicros: number;
  funded: boolean;
  decision: EnforceDecision;
  paused: string[];
  deleted: string[];
  errors: string[];
}

export interface EnforceRunResult {
  /** Report only (?dryRun=1): nothing was written, paused, emailed or deleted. */
  dryRun: boolean;
  /**
   * Whether the destructive half ran: deletion warnings and runtime deletion
   * (WALLET_ENFORCE_ENABLED=true). Pausing at zero and the promo kill switch
   * are safe and reversible, so they always run outside a dry run.
   */
  destructive: boolean;
  users: number;
  paused: number;
  deleted: number;
  warnings: number;
  killSwitches: number;
  errors: number;
  reports: EnforceUserReport[];
  /**
   * Auto-recharges still "processing" whose webhook never came, settled
   * against Stripe (lib/wallet/auto-recharge.ts reconcilePendingAutoRecharges).
   * Null on a dry run.
   */
  autoRecharge: {
    checked: number;
    credited: number;
    failed: number;
    cleared: number;
    errors: number;
  } | null;
}

/**
 * Whether the destructive half of enforcement (day 0/7/13 deletion warnings,
 * day-14 runtime deletion) runs: WALLET_ENFORCE_ENABLED=true. Pausing at zero
 * and the promo kill switch always run, whatever this says.
 */
export function isEnforcementEnabled(): boolean {
  return process.env.WALLET_ENFORCE_ENABLED === "true";
}

/**
 * Wallet enforcement (cron, every 5 minutes, after metering): pause the boxes
 * of accounts with no credit or over the promo cost caps, and run the
 * promo-only deletion countdown. Only users with a box are looked at.
 */
export async function runWalletEnforce(
  opts: { now?: Date; dryRun?: boolean; destructive?: boolean } = {}
): Promise<EnforceRunResult> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun ?? false;
  const destructive = opts.destructive ?? isEnforcementEnabled();
  const db = getDb();
  const out: EnforceRunResult = {
    dryRun,
    destructive,
    users: 0,
    paused: 0,
    deleted: 0,
    warnings: 0,
    killSwitches: 0,
    errors: 0,
    reports: [],
    autoRecharge: null,
  };

  // A pending auto-recharge marker whose webhook was lost would block every
  // new recharge: settle it against Stripe first (never throws). Runs even
  // when no user has a box.
  if (!dryRun) {
    out.autoRecharge = await import("@/lib/wallet/auto-recharge")
      .then((m) => m.reconcilePendingAutoRecharges(now))
      .catch((err: unknown) => {
        console.error("[wallet-enforce] auto-recharge reconciliation failed:", err);
        return null;
      });
  }

  const boxed = await db
    .select({ id: servers.id, userId: servers.userId, status: servers.status })
    .from(servers)
    .where(
      and(
        isNotNull(servers.boxId),
        eq(servers.hostType, "upstash_box"),
        ne(servers.status, "destroyed")
      )
    );
  const byUser = new Map<string, { active: string[]; runtime: string[] }>();
  for (const s of boxed) {
    const e = byUser.get(s.userId) ?? { active: [], runtime: [] };
    e.runtime.push(s.id);
    if (s.status === "running") e.active.push(s.id);
    byUser.set(s.userId, e);
  }
  const userIds = [...byUser.keys()];
  out.users = userIds.length;
  if (userIds.length === 0) return out;

  const accounts = new Map<
    string,
    {
      subscriptionStatus: string | null;
      paidMicros: number;
      promoMicros: number;
      promoExpiresAt: Date | null;
      fundedAt: Date | null;
      zeroBalanceAt: Date | null;
      notified: Record<string, unknown>;
      hasWallet: boolean;
    }
  >();
  const costs = new Map<string, { today: number; total: number }>();
  const dayStart = new Date(`${utcDay(now)}T00:00:00.000Z`);
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500);
    const rows = await db
      .select({
        userId: users.id,
        subscriptionStatus: users.subscriptionStatus,
        paidMicros: walletAccounts.paidMicros,
        promoMicros: walletAccounts.promoMicros,
        promoExpiresAt: walletAccounts.promoExpiresAt,
        fundedAt: walletAccounts.fundedAt,
        zeroBalanceAt: walletAccounts.zeroBalanceAt,
        notified: walletAccounts.notified,
      })
      .from(users)
      .leftJoin(walletAccounts, eq(walletAccounts.userId, users.id))
      .where(inArray(users.id, chunk));
    for (const r of rows) {
      accounts.set(r.userId, {
        subscriptionStatus: r.subscriptionStatus ?? null,
        paidMicros: Number(r.paidMicros ?? 0),
        promoMicros: Number(r.promoMicros ?? 0),
        promoExpiresAt: r.promoExpiresAt ?? null,
        fundedAt: r.fundedAt ?? null,
        zeroBalanceAt: r.zeroBalanceAt ?? null,
        notified: r.notified ?? {},
        hasWallet: r.paidMicros != null,
      });
    }
    // Real compute cost billed per user: units.deltaUsd of usage_compute rows.
    // A debit split across buckets copies units onto a second row keyed
    // `<key>#<bucket>`, so only the main row (no '#') is counted.
    const usd = sql`coalesce((${creditLedger.units}->>'deltaUsd')::numeric, 0)`;
    const costRows = await db
      .select({
        userId: creditLedger.userId,
        today: sql<
          string | null
        >`sum(case when ${creditLedger.createdAt} >= ${dayStart.toISOString()}::timestamptz then ${usd} else 0 end)::text`,
        total: sql<string | null>`sum(${usd})::text`,
      })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.kind, "usage_compute"),
          inArray(creditLedger.userId, chunk),
          sql`position('#' in ${creditLedger.idempotencyKey}) = 0`
        )
      )
      .groupBy(creditLedger.userId);
    for (const r of costRows) {
      if (!r.userId) continue;
      costs.set(r.userId, { today: Number(r.today ?? 0), total: Number(r.total ?? 0) });
    }
  }

  const { pauseServerRuntime, destroyServerRuntime } = await import("@/lib/provisioning");

  for (const userId of userIds) {
    const acct = accounts.get(userId);
    if (!acct) continue; // user row gone (cascade in flight)
    const srv = byUser.get(userId)!;
    const funded = isFunded(acct.fundedAt, acct.subscriptionStatus);
    const totalMicros = effectiveTotalMicros(acct, now);
    const cost = costs.get(userId) ?? { today: 0, total: 0 };
    const decision = decideEnforcement({
      now,
      totalMicros,
      funded,
      promoExpiresAt: acct.promoExpiresAt,
      zeroBalanceAt: acct.zeroBalanceAt,
      notified: acct.notified,
      activeServerIds: srv.active,
      runtimeServerIds: srv.runtime,
      computeCostTodayUsd: cost.today,
      computeCostTotalUsd: cost.total,
      payingSubscription: isFunded(null, acct.subscriptionStatus),
    });
    // Without WALLET_ENFORCE_ENABLED, the deletion countdown stays a report:
    // no warning email, no stamp, no deletion. Pauses still apply.
    if (!destructive) {
      decision.warning = null;
      decision.deleteRuntimeServerIds = [];
    }
    const report: EnforceUserReport = {
      userId,
      totalMicros,
      funded,
      decision,
      paused: [],
      deleted: [],
      errors: [],
    };
    out.reports.push(report);
    if (decision.newKillSwitch) out.killSwitches++;
    if (decision.warning) out.warnings++;
    if (dryRun) {
      out.paused += decision.pauseServerIds.length;
      out.deleted += decision.deleteRuntimeServerIds.length;
      continue;
    }

    try {
      await applyDecision(userId, acct.hasWallet, srv.runtime.length, decision, report, now, {
        pauseServerRuntime,
        destroyServerRuntime,
      });
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : String(err));
      console.error(`[wallet-enforce] user ${userId} failed:`, err);
      Sentry.captureException(err, {
        tags: { area: "wallet", stage: "enforce" },
        extra: { userId },
      });
    }
    out.paused += report.paused.length;
    out.deleted += report.deleted.length;
    if (report.errors.length > 0) out.errors++;
  }
  return out;
}

async function applyDecision(
  userId: string,
  hasWallet: boolean,
  runtimeCount: number,
  decision: EnforceDecision,
  report: EnforceUserReport,
  now: Date,
  ops: {
    pauseServerRuntime: (serverId: string) => Promise<unknown>;
    destroyServerRuntime: (serverId: string) => Promise<void>;
  }
): Promise<void> {
  const db = getDb();

  // Ensure a wallet row exists so the timers and flags below have a home.
  if (!hasWallet && (decision.zeroBalanceAt || decision.newKillSwitch || decision.warning)) {
    await db
      .insert(walletAccounts)
      .values({ userId })
      .onConflictDoNothing({ target: walletAccounts.userId });
  }
  if (decision.zeroBalanceAt !== undefined) {
    await db
      .update(walletAccounts)
      .set({
        zeroBalanceAt:
          decision.zeroBalanceAt === null
            ? null
            : sql`coalesce(${walletAccounts.zeroBalanceAt}, ${decision.zeroBalanceAt.toISOString()}::timestamptz)`,
        updatedAt: now,
      })
      .where(eq(walletAccounts.userId, userId));
  }

  if (decision.newKillSwitch) {
    await setNotifiedKey(userId, NOTIFIED_KEYS.killSwitch, decision.newKillSwitch);
    await writeAudit(userId, "wallet.promo_kill_switch", null, { ...decision.newKillSwitch });
  }

  for (const serverId of decision.pauseServerIds) {
    try {
      await ops.pauseServerRuntime(serverId);
      report.paused.push(serverId);
    } catch (err) {
      report.errors.push(`pause ${serverId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (report.paused.length > 0) {
    await writeAudit(userId, "wallet.enforce.pause", null, {
      reason: decision.pauseReason,
      servers: report.paused,
    });
  }

  if (decision.warning && decision.cycle) {
    const { notifyWalletStateWithOutcome } = await import("@/lib/wallet/notify");
    // notify keys the dedupe on the numeric stage (0 | 7 | 13).
    const outcome = await notifyWalletStateWithOutcome(userId, "runtime_deletion_warning", {
      stage: stageDays(decision.warning),
      cycle: decision.cycle,
      deleteAt: decision.deleteAt?.toISOString() ?? null,
      servers: runtimeCount,
    });
    // Stamp only a warning that really went out (or already had): the day-14
    // deletion requires the day-13 stamp, so an undelivered warning (no
    // mailer, Resend error…) blocks the deletion instead of skipping a step.
    if (outcome === "sent" || outcome === "deduped") {
      const stamp: CycleStamp = { at: now.toISOString(), cycle: decision.cycle };
      await setNotifiedKey(userId, NOTIFIED_KEYS.deletionWarning(decision.warning), stamp);
    } else {
      report.errors.push(`deletion warning ${decision.warning} for ${userId}: ${outcome}`);
    }
  }

  if (decision.deleteRuntimeServerIds.length > 0 && decision.cycle) {
    // Re-read right before deleting: a top-up since the batch read cancels it,
    // and a funded account is never deleted.
    const [fresh] = await db
      .select({
        subscriptionStatus: users.subscriptionStatus,
        paidMicros: walletAccounts.paidMicros,
        promoMicros: walletAccounts.promoMicros,
        promoExpiresAt: walletAccounts.promoExpiresAt,
        fundedAt: walletAccounts.fundedAt,
      })
      .from(users)
      .leftJoin(walletAccounts, eq(walletAccounts.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    const freshTotal = effectiveTotalMicros(
      fresh
        ? {
            paidMicros: Number(fresh.paidMicros ?? 0),
            promoMicros: Number(fresh.promoMicros ?? 0),
            promoExpiresAt: fresh.promoExpiresAt ?? null,
          }
        : null,
      now
    );
    if (!fresh || isFunded(fresh.fundedAt ?? null, fresh.subscriptionStatus) || freshTotal > 0)
      return;

    for (const serverId of decision.deleteRuntimeServerIds) {
      try {
        // Box only: server row, MCP list and configs are kept (Start recreates it).
        await ops.destroyServerRuntime(serverId);
        report.deleted.push(serverId);
      } catch (err) {
        report.errors.push(
          `delete ${serverId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    if (report.deleted.length > 0) {
      await writeAudit(userId, "wallet.enforce.runtime_deleted", null, {
        servers: report.deleted,
        cycle: decision.cycle,
      });
      const stamp: CycleStamp = { at: now.toISOString(), cycle: decision.cycle };
      await setNotifiedKey(userId, NOTIFIED_KEYS.runtimeDeleted, stamp);
    }
  }
}

/** Threshold helper for callers that need the overdraft in micros. */
export function overdraftMicros(p: Pricing = PRICING): number {
  return eurToMicros(p.overdraftEur);
}
