import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  creditLedger,
  walletAccounts,
  type LedgerKind,
  type WalletAccountRow,
  type WalletBucket,
} from "@/db/schema/wallet";
import { afterBalanceChange } from "./after-debit";

// Prepaid wallet ledger (contract W1). Money is integer micro-euros.
//
// Every balance change runs in ONE transaction that locks the user's
// wallet_accounts row (SELECT ... FOR UPDATE, row created on first use),
// checks the idempotency key, writes credit_ledger rows and the new balance.
// The arithmetic is in the pure functions applyDebit / applyCredit /
// applyExpiry below; the transaction only loads, checks and persists, so the
// money rules are tested without a database (wallet-ledger.test.ts drives the
// same debitWith/creditWith code through an in-memory store).
//
// Rules:
// - The promo bucket is spent first, never goes below zero, and stops counting
//   at promo_expires_at (an expired remainder is written off as a promo_expiry
//   row the next time the wallet is touched, or by the expiry cron).
// - The paid bucket may go negative: usage that already happened is charged.
// - hasCredit() fails CLOSED (false) on a database error.

// ---------------------------------------------------------------------------
// Pure arithmetic
// ---------------------------------------------------------------------------

export interface WalletState {
  paidMicros: number;
  promoMicros: number;
  promoExpiresAt: Date | null;
  /** Low-balance / auto-recharge threshold (wallet_accounts.auto_recharge_threshold_micros). */
  thresholdMicros: number;
  fundedAt: Date | null;
  zeroBalanceAt: Date | null;
}

export interface LedgerLine {
  bucket: WalletBucket;
  kind: LedgerKind;
  deltaMicros: number;
  balanceAfterMicros: number;
}

export const DEBIT_KINDS = ["usage_tool_call", "usage_compute", "clawback", "adjustment"] as const;
export type DebitKind = (typeof DEBIT_KINDS)[number];

export const CREDIT_KINDS = [
  "signup_credit",
  "topup",
  "auto_recharge",
  "admin_grant",
  "subscription_conversion",
  "adjustment",
] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];

/** Paid credits of these kinds mark the wallet as funded (first one sets funded_at). */
export const FUNDING_KINDS: readonly CreditKind[] = [
  "topup",
  "auto_recharge",
  "subscription_conversion",
];

export const DEFAULT_THRESHOLD_MICROS = 5_000_000;

export function emptyWalletState(): WalletState {
  return {
    paidMicros: 0,
    promoMicros: 0,
    promoExpiresAt: null,
    thresholdMicros: DEFAULT_THRESHOLD_MICROS,
    fundedAt: null,
    zeroBalanceAt: null,
  };
}

/** A promo with no expiry date never expires; otherwise it is dead at expires_at. */
export function isPromoExpired(s: Pick<WalletState, "promoExpiresAt">, now: Date): boolean {
  return s.promoExpiresAt !== null && s.promoExpiresAt.getTime() <= now.getTime();
}

export function effectivePromoMicros(
  s: Pick<WalletState, "promoMicros" | "promoExpiresAt">,
  now: Date
): number {
  return isPromoExpired(s, now) ? 0 : Math.max(0, s.promoMicros);
}

export function totalMicrosOf(
  s: Pick<WalletState, "paidMicros" | "promoMicros" | "promoExpiresAt">,
  now: Date
): number {
  return s.paidMicros + effectivePromoMicros(s, now);
}

function assertAmount(amountMicros: number): void {
  if (!Number.isSafeInteger(amountMicros) || amountMicros <= 0) {
    throw new RangeError(`amountMicros must be a positive integer, got ${amountMicros}`);
  }
}

/** Write off an expired promo remainder. No-op (no lines) when nothing is expired. */
export function applyExpiry(
  s: WalletState,
  now: Date
): { state: WalletState; lines: LedgerLine[] } {
  if (s.promoMicros <= 0 || !isPromoExpired(s, now)) return { state: s, lines: [] };
  const state: WalletState = { ...s, promoMicros: 0 };
  const total = state.paidMicros;
  if (total <= 0 && state.zeroBalanceAt === null) state.zeroBalanceAt = now;
  return {
    state,
    lines: [
      {
        bucket: "promo",
        kind: "promo_expiry",
        deltaMicros: 0 - s.promoMicros,
        balanceAfterMicros: total,
      },
    ],
  };
}

export interface DebitOutcome {
  state: WalletState;
  /** promo_expiry line first (if any), then the debit lines (promo part, paid part). */
  lines: LedgerLine[];
  totalBeforeMicros: number;
  totalAfterMicros: number;
  /** Balance went from > 0 to <= 0. */
  crossedZero: boolean;
  /** Balance went from > threshold to <= threshold. */
  crossedThreshold: boolean;
}

/**
 * Take `amountMicros` from the wallet. Default: promo first (if live), then
 * paid, which may go negative. `bucket: "paid"` charges only paid (a clawback
 * of a refunded top-up); `bucket: "promo"` takes only what promo holds and
 * never goes below zero.
 */
export function applyDebit(
  s: WalletState,
  amountMicros: number,
  kind: DebitKind,
  now: Date,
  bucket?: WalletBucket
): DebitOutcome {
  assertAmount(amountMicros);
  const expired = applyExpiry(s, now);
  const e = expired.state;
  const before = e.paidMicros + e.promoMicros;

  let promoTaken = 0;
  let paidTaken = 0;
  if (bucket === "paid") {
    paidTaken = amountMicros;
  } else if (bucket === "promo") {
    promoTaken = Math.min(amountMicros, Math.max(0, e.promoMicros));
  } else {
    promoTaken = Math.min(amountMicros, Math.max(0, e.promoMicros));
    paidTaken = amountMicros - promoTaken;
  }

  const after = before - promoTaken - paidTaken;
  const lines = [...expired.lines];
  if (promoTaken > 0 || bucket === "promo") {
    lines.push({
      bucket: "promo",
      kind,
      deltaMicros: 0 - promoTaken,
      balanceAfterMicros: before - promoTaken,
    });
  }
  if (paidTaken > 0) {
    lines.push({ bucket: "paid", kind, deltaMicros: 0 - paidTaken, balanceAfterMicros: after });
  }

  const state: WalletState = {
    ...e,
    promoMicros: e.promoMicros - promoTaken,
    paidMicros: e.paidMicros - paidTaken,
    zeroBalanceAt: after <= 0 ? (e.zeroBalanceAt ?? now) : e.zeroBalanceAt,
  };
  return {
    state,
    lines,
    totalBeforeMicros: before,
    totalAfterMicros: after,
    crossedZero: before > 0 && after <= 0,
    crossedThreshold: before > e.thresholdMicros && after <= e.thresholdMicros,
  };
}

export interface CreditOutcome {
  state: WalletState;
  lines: LedgerLine[];
  totalBeforeMicros: number;
  totalAfterMicros: number;
  /** Balance went from <= 0 to > 0. */
  recoveredFromZero: boolean;
}

/**
 * Add `amountMicros` to a bucket. A promo credit takes `expiresAt` (null or
 * omitted = never expires); added to a still-live promo, the later expiry
 * wins (a never-expiring side wins over a dated one). A paid credit of a
 * FUNDING_KINDS kind sets fundedAt the first time.
 */
export function applyCredit(
  s: WalletState,
  amountMicros: number,
  bucket: WalletBucket,
  kind: CreditKind,
  now: Date,
  expiresAt?: Date | null
): CreditOutcome {
  assertAmount(amountMicros);
  if (bucket === "promo" && expiresAt && expiresAt.getTime() <= now.getTime()) {
    throw new RangeError("promo credit expiresAt is in the past");
  }
  const expired = applyExpiry(s, now);
  const e = expired.state;
  const before = e.paidMicros + e.promoMicros;
  const after = before + amountMicros;

  const state: WalletState = { ...e };
  if (bucket === "paid") {
    state.paidMicros = e.paidMicros + amountMicros;
    if (FUNDING_KINDS.includes(kind) && state.fundedAt === null) state.fundedAt = now;
  } else {
    const next = expiresAt ?? null;
    if (e.promoMicros > 0) {
      // Promo grants share one bucket: the EARLIEST dated expiry wins, so a
      // later or non-expiring grant never extends the published "valid 30
      // days" rule of the sign-up credit (null = never only when both are).
      state.promoExpiresAt =
        e.promoExpiresAt === null
          ? next
          : next === null
            ? e.promoExpiresAt
            : new Date(Math.min(e.promoExpiresAt.getTime(), next.getTime()));
    } else {
      state.promoExpiresAt = next;
    }
    state.promoMicros = e.promoMicros + amountMicros;
  }
  if (after > 0) state.zeroBalanceAt = null;

  return {
    state,
    lines: [
      ...expired.lines,
      { bucket, kind, deltaMicros: amountMicros, balanceAfterMicros: after },
    ],
    totalBeforeMicros: before,
    totalAfterMicros: after,
    recoveredFromZero: before <= 0 && after > 0,
  };
}

// ---------------------------------------------------------------------------
// Store abstraction (Postgres in production, in-memory in tests)
// ---------------------------------------------------------------------------

export interface NewLedgerRow {
  userId: string;
  deltaMicros: number;
  bucket: WalletBucket;
  kind: LedgerKind;
  idempotencyKey: string;
  balanceAfterMicros: number;
  stripeRef?: string | null;
  units?: Record<string, unknown> | null;
  note?: string | null;
}

/** One locked wallet inside one transaction. */
export interface WalletStore {
  /** Lock the user's wallet row (creating it if missing) and return its state. */
  lock(userId: string): Promise<WalletState>;
  hasKey(idempotencyKey: string): Promise<boolean>;
  insert(rows: NewLedgerRow[]): Promise<void>;
  save(userId: string, state: WalletState): Promise<void>;
}

export type WalletRunner = <T>(fn: (store: WalletStore) => Promise<T>) => Promise<T>;

/**
 * Ledger rows for an outcome: promo_expiry lines get their own key, the first
 * operation line gets the caller's key and a second one (a debit split across
 * buckets) gets `<key>#<bucket>`.
 */
export function ledgerRowsFor(
  lines: LedgerLine[],
  meta: {
    userId: string;
    idempotencyKey: string;
    stripeRef?: string | null;
    units?: Record<string, unknown> | null;
    note?: string | null;
  },
  newId: () => string = randomUUID
): NewLedgerRow[] {
  let mainSeen = 0;
  return lines.map((l) => {
    if (l.kind === "promo_expiry") {
      return {
        userId: meta.userId,
        deltaMicros: l.deltaMicros,
        bucket: l.bucket,
        kind: l.kind,
        idempotencyKey: `promo_expiry:${meta.userId}:${newId()}`,
        balanceAfterMicros: l.balanceAfterMicros,
        note: "Promotional credit expired",
      };
    }
    const key = mainSeen === 0 ? meta.idempotencyKey : `${meta.idempotencyKey}#${l.bucket}`;
    mainSeen += 1;
    return {
      userId: meta.userId,
      deltaMicros: l.deltaMicros,
      bucket: l.bucket,
      kind: l.kind,
      idempotencyKey: key,
      balanceAfterMicros: l.balanceAfterMicros,
      stripeRef: meta.stripeRef ?? null,
      units: meta.units ?? null,
      note: meta.note ?? null,
    };
  });
}

export interface DebitInput {
  userId: string;
  amountMicros: number;
  kind: DebitKind;
  idempotencyKey: string;
  units?: Record<string, unknown>;
  note?: string;
  /** Restrict to one bucket (clawback of a paid top-up: "paid"). Default promo-first. */
  bucket?: WalletBucket;
  stripeRef?: string;
  /**
   * Usage only: how far below zero this debit may take the total balance
   * (the published overdraft). The part beyond it is written off: not
   * charged, recorded as units.writtenOffMicros on the row. Unset: no floor
   * (a clawback must take the whole refunded amount).
   */
  floorMicros?: number;
}

export interface DebitResult {
  applied: boolean;
  totalMicros: number;
  crossedZero: boolean;
  crossedThreshold: boolean;
  /** Usage written off by the overdraft floor (0 or absent: none). */
  writtenOffMicros?: number;
}

/**
 * Split a usage amount at the overdraft floor: what may still be charged so
 * the total stays >= -floorMicros, and what is written off. Pure.
 */
export function capAtFloor(
  totalBeforeMicros: number,
  amountMicros: number,
  floorMicros: number
): { chargeMicros: number; writtenOffMicros: number } {
  const room = Math.max(0, totalBeforeMicros + Math.max(0, floorMicros));
  const chargeMicros = Math.min(amountMicros, room);
  return { chargeMicros, writtenOffMicros: amountMicros - chargeMicros };
}

export interface CreditInput {
  userId: string;
  amountMicros: number;
  bucket: WalletBucket;
  kind: CreditKind;
  idempotencyKey: string;
  stripeRef?: string;
  /** Promo bucket only: when this promo stops counting. */
  expiresAt?: Date | null;
  note?: string;
  units?: Record<string, unknown>;
}

export interface CreditResult {
  applied: boolean;
  totalMicros: number;
  recoveredFromZero: boolean;
}

function assertKind<K extends string>(kind: string, allowed: readonly K[], op: string): void {
  if (!(allowed as readonly string[]).includes(kind)) {
    throw new RangeError(`${op}: kind "${kind}" is not allowed`);
  }
}

function assertKey(key: string): void {
  if (typeof key !== "string" || key.trim() === "" || key.length > 300) {
    throw new RangeError("idempotencyKey must be a non-empty string of at most 300 chars");
  }
}

/** Debit through any store. Duplicate key: applied=false, nothing written. */
export async function debitWith(
  run: WalletRunner,
  input: DebitInput,
  now: Date
): Promise<DebitResult> {
  assertKind(input.kind, DEBIT_KINDS, "debit");
  assertKey(input.idempotencyKey);
  assertAmount(input.amountMicros);
  return run(async (store) => {
    const s = await store.lock(input.userId);
    if (await store.hasKey(input.idempotencyKey)) {
      return {
        applied: false,
        totalMicros: totalMicrosOf(s, now),
        crossedZero: false,
        crossedThreshold: false,
      };
    }
    let amount = input.amountMicros;
    let writtenOff = 0;
    let rowInput: DebitInput = input;
    if (input.floorMicros !== undefined) {
      const cap = capAtFloor(totalMicrosOf(s, now), amount, input.floorMicros);
      amount = cap.chargeMicros;
      writtenOff = cap.writtenOffMicros;
      if (writtenOff > 0) {
        rowInput = {
          ...input,
          units: {
            ...input.units,
            requestedMicros: input.amountMicros,
            writtenOffMicros: writtenOff,
          },
        };
      }
      if (amount === 0) {
        // Already at the floor: nothing is charged, nothing is written.
        return {
          applied: false,
          totalMicros: totalMicrosOf(s, now),
          crossedZero: false,
          crossedThreshold: false,
          writtenOffMicros: writtenOff,
        };
      }
    }
    const out = applyDebit(s, amount, input.kind, now, input.bucket);
    await store.insert(ledgerRowsFor(out.lines, rowInput));
    await store.save(input.userId, out.state);
    return {
      applied: true,
      totalMicros: out.totalAfterMicros,
      crossedZero: out.crossedZero,
      crossedThreshold: out.crossedThreshold,
      ...(writtenOff > 0 ? { writtenOffMicros: writtenOff } : {}),
    };
  });
}

/** Credit through any store. Duplicate key: applied=false, nothing written. */
export async function creditWith(
  run: WalletRunner,
  input: CreditInput,
  now: Date
): Promise<CreditResult> {
  assertKind(input.kind, CREDIT_KINDS, "credit");
  assertKey(input.idempotencyKey);
  assertAmount(input.amountMicros);
  return run(async (store) => {
    const s = await store.lock(input.userId);
    if (await store.hasKey(input.idempotencyKey)) {
      return { applied: false, totalMicros: totalMicrosOf(s, now), recoveredFromZero: false };
    }
    const out = applyCredit(
      s,
      input.amountMicros,
      input.bucket,
      input.kind,
      now,
      input.bucket === "promo" ? input.expiresAt : undefined
    );
    await store.insert(ledgerRowsFor(out.lines, input));
    await store.save(input.userId, out.state);
    return {
      applied: true,
      totalMicros: out.totalAfterMicros,
      recoveredFromZero: out.recoveredFromZero,
    };
  });
}

// ---------------------------------------------------------------------------
// Postgres store
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function stateFromRow(row: WalletAccountRow): WalletState {
  return {
    paidMicros: Number(row.paidMicros),
    promoMicros: Number(row.promoMicros),
    promoExpiresAt: row.promoExpiresAt ?? null,
    thresholdMicros: Number(row.autoRechargeThresholdMicros),
    fundedAt: row.fundedAt ?? null,
    zeroBalanceAt: row.zeroBalanceAt ?? null,
  };
}

function dbStore(tx: Tx): WalletStore {
  const select = (userId: string) =>
    tx
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .for("update")
      .limit(1);
  return {
    async lock(userId) {
      let [row] = await select(userId);
      if (!row) {
        // A concurrent first touch blocks on the PK until we commit, then no-ops.
        await tx.insert(walletAccounts).values({ userId }).onConflictDoNothing();
        [row] = await select(userId);
      }
      if (!row) throw new Error(`wallet_accounts row for ${userId} could not be created`);
      return stateFromRow(row);
    },
    async hasKey(idempotencyKey) {
      const [hit] = await tx
        .select({ id: creditLedger.id })
        .from(creditLedger)
        .where(eq(creditLedger.idempotencyKey, idempotencyKey))
        .limit(1);
      return Boolean(hit);
    },
    async insert(rows) {
      if (rows.length === 0) return;
      await tx.insert(creditLedger).values(rows);
    },
    async save(userId, state) {
      await tx
        .update(walletAccounts)
        .set({
          paidMicros: state.paidMicros,
          promoMicros: state.promoMicros,
          promoExpiresAt: state.promoExpiresAt,
          fundedAt: state.fundedAt,
          zeroBalanceAt: state.zeroBalanceAt,
          updatedAt: new Date(),
        })
        .where(eq(walletAccounts.userId, userId));
    },
  };
}

const dbRunner: WalletRunner = (fn) => getDb().transaction((tx) => fn(dbStore(tx)));

/** Postgres unique_violation, whether drizzle surfaces the driver error or wraps it. */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 4; i++) {
    if (typeof e === "object" && (e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WalletView {
  paidMicros: number;
  /** 0 once expired. */
  promoMicros: number;
  promoExpiresAt: Date | null;
  promoExpired: boolean;
  totalMicros: number;
  funded: boolean;
  fundedAt: Date | null;
  zeroBalanceAt: Date | null;
  autoRecharge: {
    enabled: boolean;
    thresholdMicros: number;
    amountMicros: number;
    monthlyCapMicros: number;
    hasPaymentMethod: boolean;
  };
}

/** Wallet view of a row (or of no row yet: an empty, unfunded wallet). Pure. */
export function walletViewFromRow(row: WalletAccountRow | undefined, now: Date): WalletView {
  if (!row) {
    return {
      paidMicros: 0,
      promoMicros: 0,
      promoExpiresAt: null,
      promoExpired: false,
      totalMicros: 0,
      funded: false,
      fundedAt: null,
      zeroBalanceAt: null,
      autoRecharge: {
        enabled: false,
        thresholdMicros: DEFAULT_THRESHOLD_MICROS,
        amountMicros: 20_000_000,
        monthlyCapMicros: 100_000_000,
        hasPaymentMethod: false,
      },
    };
  }
  const s = stateFromRow(row);
  const promo = effectivePromoMicros(s, now);
  return {
    paidMicros: s.paidMicros,
    promoMicros: promo,
    promoExpiresAt: s.promoExpiresAt,
    promoExpired: s.promoMicros > 0 && isPromoExpired(s, now),
    totalMicros: s.paidMicros + promo,
    funded: s.fundedAt !== null,
    fundedAt: s.fundedAt,
    zeroBalanceAt: s.zeroBalanceAt,
    autoRecharge: {
      enabled: row.autoRechargeEnabled,
      thresholdMicros: Number(row.autoRechargeThresholdMicros),
      amountMicros: Number(row.autoRechargeAmountMicros),
      monthlyCapMicros: Number(row.autoRechargeMonthlyCapMicros),
      hasPaymentMethod: Boolean(row.stripePaymentMethodId),
    },
  };
}

/** Current wallet (no row → empty wallet; never creates one). Throws on DB error. */
export async function getWallet(userId: string): Promise<WalletView> {
  const [row] = await getDb()
    .select()
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1);
  return walletViewFromRow(row, new Date());
}

// --- hasCredit cache (per process, <= 5 s, invalidated by local changes) ---

export const CREDIT_CACHE_TTL_MS = 5_000;
const CREDIT_CACHE_MAX = 10_000;
const creditCache = new Map<string, { ok: boolean; at: number }>();
const creditInflight = new Map<string, { promise?: Promise<boolean> }>();

/** Drop the cached hasCredit answer for one user (or all). */
export function invalidateCreditCache(userId?: string): void {
  if (userId === undefined) {
    creditCache.clear();
    creditInflight.clear();
  } else {
    creditCache.delete(userId);
    creditInflight.delete(userId);
  }
}

/**
 * Whether the user may start billable work: total balance > 0. Cached per
 * process for up to 5 s (a burst of tool calls costs one query). Any error
 * returns false: no credit check, no free usage.
 */
export async function hasCredit(userId: string): Promise<boolean> {
  const hit = creditCache.get(userId);
  if (hit && Date.now() - hit.at < CREDIT_CACHE_TTL_MS) return hit.ok;
  const pending = creditInflight.get(userId);
  if (pending?.promise) return pending.promise;

  // The entry object identifies this lookup: an invalidation in the meantime
  // replaces or deletes it, and a stale answer is then not cached.
  const entry: { promise?: Promise<boolean> } = {};
  entry.promise = (async () => {
    try {
      const w = await getWallet(userId);
      const ok = w.totalMicros > 0;
      if (creditCache.size >= CREDIT_CACHE_MAX) creditCache.clear();
      if (creditInflight.get(userId) === entry) creditCache.set(userId, { ok, at: Date.now() });
      return ok;
    } catch (err) {
      console.error("[wallet] hasCredit failed, refusing (fail closed)", err);
      return false;
    } finally {
      if (creditInflight.get(userId) === entry) creditInflight.delete(userId);
    }
  })();
  creditInflight.set(userId, entry);
  return entry.promise;
}

/**
 * Charge the wallet. One transaction, row-locked; promo first, then paid
 * (which may go negative). A duplicate idempotency key returns applied=false.
 * debit() has no side effects beyond the ledger: the CALLER passes the result
 * to afterBalanceChange(userId, result) (after-debit.ts), which fires
 * auto-recharge and the wallet emails when a threshold or zero was crossed.
 */
export async function debit(
  input: DebitInput,
  opts: {
    /**
     * Runs first, inside the debit's own transaction (e.g. the compute
     * meter's snapshot compare-and-swap), so both commit or neither does.
     * Throwing aborts the debit.
     */
    pre?: (tx: Tx) => Promise<void>;
  } = {}
): Promise<DebitResult> {
  const pre = opts.pre;
  const runner: WalletRunner = pre
    ? (fn) =>
        getDb().transaction(async (tx) => {
          await pre(tx);
          return fn(dbStore(tx));
        })
    : dbRunner;
  try {
    return await debitWith(runner, input, new Date());
  } catch (err) {
    // Same key raced in another transaction that committed first.
    if (!isUniqueViolation(err)) throw err;
    const w = await getWallet(input.userId);
    return {
      applied: false,
      totalMicros: w.totalMicros,
      crossedZero: false,
      crossedThreshold: false,
    };
  } finally {
    invalidateCreditCache(input.userId);
  }
}

/** Add credit. One transaction, row-locked. A duplicate idempotency key returns applied=false. */
export async function credit(input: CreditInput): Promise<CreditResult> {
  try {
    return await creditWith(dbRunner, input, new Date());
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const w = await getWallet(input.userId);
    return { applied: false, totalMicros: w.totalMicros, recoveredFromZero: false };
  } finally {
    invalidateCreditCache(input.userId);
  }
}

/** Sum of ledger deltas of `kinds` since `since` (e.g. auto-recharge monthly cap). */
export async function sumLedgerSince(
  userId: string,
  kinds: readonly LedgerKind[],
  since: Date
): Promise<number> {
  if (kinds.length === 0) return 0;
  const [row] = await getDb()
    .select({ total: sql<string>`coalesce(sum(${creditLedger.deltaMicros}), 0)::text` })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, userId),
        inArray(creditLedger.kind, [...kinds]),
        sql`${creditLedger.createdAt} >= ${since.toISOString()}::timestamptz`
      )
    );
  return Number(row?.total ?? 0);
}

// --- promo expiry (cron) ---

export interface ExpirePromosResult {
  expired: number;
  expiredMicros: number;
  /** More due wallets than the batch: run again. */
  truncated: boolean;
}

/** Write off every promo balance past its expiry. Batched; safe to re-run. */
export async function expirePromos(
  now: Date = new Date(),
  limit = 500
): Promise<ExpirePromosResult> {
  const due = await getDb()
    .select({ userId: walletAccounts.userId })
    .from(walletAccounts)
    .where(
      and(
        gt(walletAccounts.promoMicros, 0),
        isNotNull(walletAccounts.promoExpiresAt),
        lte(walletAccounts.promoExpiresAt, now)
      )
    )
    .limit(limit + 1);
  const batch = due.slice(0, limit);

  let expired = 0;
  let expiredMicros = 0;
  for (const { userId } of batch) {
    try {
      const out = await dbRunner(async (store) => {
        const s = await store.lock(userId);
        const r = applyExpiry(s, now);
        if (r.lines.length === 0) return null; // already handled by a concurrent touch
        await store.insert(ledgerRowsFor(r.lines, { userId, idempotencyKey: "unused" }));
        await store.save(userId, r.state);
        return { micros: -r.lines[0].deltaMicros, totalAfter: r.state.paidMicros };
      });
      if (!out) continue;
      expired += 1;
      expiredMicros += out.micros;
      invalidateCreditCache(userId);
      if (out.totalAfter <= 0) {
        afterBalanceChange(userId, {
          applied: true,
          totalMicros: out.totalAfter,
          crossedZero: true,
          crossedThreshold: false,
          kind: "promo_expiry",
        });
      }
    } catch (err) {
      console.error(`[wallet] promo expiry failed for ${userId}`, err);
    }
  }
  return { expired, expiredMicros, truncated: due.length > limit };
}

/** Live promo balances expiring in (from, to] — for the 7-day / 2-day reminders. */
export async function promosExpiringBetween(
  from: Date,
  to: Date,
  limit = 1000
): Promise<{ userId: string; promoMicros: number; promoExpiresAt: Date }[]> {
  const rows = await getDb()
    .select({
      userId: walletAccounts.userId,
      promoMicros: walletAccounts.promoMicros,
      promoExpiresAt: walletAccounts.promoExpiresAt,
    })
    .from(walletAccounts)
    .where(
      and(
        gt(walletAccounts.promoMicros, 0),
        gt(walletAccounts.promoExpiresAt, from),
        lte(walletAccounts.promoExpiresAt, to)
      )
    )
    .limit(limit);
  return rows.flatMap((r) =>
    r.promoExpiresAt
      ? [{ userId: r.userId, promoMicros: Number(r.promoMicros), promoExpiresAt: r.promoExpiresAt }]
      : []
  );
}

// --- history ---

export interface LedgerEntryView {
  id: string;
  deltaMicros: number;
  bucket: WalletBucket;
  kind: LedgerKind;
  balanceAfterMicros: number;
  units: Record<string, unknown> | null;
  note: string | null;
  createdAt: Date;
}

export const LEDGER_PAGE_SIZE = 50;

/** Opaque cursor: the last row's exact created_at (Postgres text, microsecond precision) and id. */
export function encodeLedgerCursor(createdAtText: string, id: string): string {
  return Buffer.from(JSON.stringify([createdAtText, id]), "utf8").toString("base64url");
}

const PG_TIMESTAMPTZ_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/;
const LEDGER_ID_RE = /^[\w-]{1,64}$/;

export function decodeLedgerCursor(cursor: string): { ts: string; id: string } | null {
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === "string" &&
      typeof v[1] === "string" &&
      PG_TIMESTAMPTZ_RE.test(v[0]) &&
      LEDGER_ID_RE.test(v[1])
    ) {
      return { ts: v[0], id: v[1] };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** One page of the user's ledger, newest first. */
export async function listLedger(
  userId: string,
  opts: { cursor?: { ts: string; id: string } | null; limit?: number } = {}
): Promise<{ entries: LedgerEntryView[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? LEDGER_PAGE_SIZE, 1), LEDGER_PAGE_SIZE);
  const c = opts.cursor;
  const rows = await getDb()
    .select({
      id: creditLedger.id,
      deltaMicros: creditLedger.deltaMicros,
      bucket: creditLedger.bucket,
      kind: creditLedger.kind,
      balanceAfterMicros: creditLedger.balanceAfterMicros,
      units: creditLedger.units,
      note: creditLedger.note,
      createdAt: creditLedger.createdAt,
      createdAtText: sql<string>`${creditLedger.createdAt}::text`,
    })
    .from(creditLedger)
    .where(
      c
        ? and(
            eq(creditLedger.userId, userId),
            sql`(${creditLedger.createdAt}, ${creditLedger.id}) < (${c.ts}::timestamptz, ${c.id})`
          )
        : eq(creditLedger.userId, userId)
    )
    .orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    entries: page.map((r) => ({
      id: r.id,
      deltaMicros: Number(r.deltaMicros),
      bucket: r.bucket,
      kind: r.kind,
      balanceAfterMicros: Number(r.balanceAfterMicros),
      units: r.units ?? null,
      note: r.note ?? null,
      createdAt: r.createdAt,
    })),
    nextCursor:
      rows.length > limit && last ? encodeLedgerCursor(last.createdAtText, last.id) : null,
  };
}
