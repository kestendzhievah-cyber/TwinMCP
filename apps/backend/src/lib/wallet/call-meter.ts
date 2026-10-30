// Tool-call billing for the MCP proxy (contract W2).
//
// Three pieces, all used by the per-MCP proxy, the aggregated / router
// endpoint and the dashboard playground:
//
//   walletAllowsCall(userId)  the gate: a billable tools/call is refused (402)
//                             before forwarding when the wallet is empty.
//                             FAILS CLOSED: any error reads as "no credit".
//   chargeToolCall(userId)    the charge: one call that reached the upstream
//                             MCP (a JSON-RPC result or a tool error). Bumps a
//                             per-process accumulator, flushed to the ledger
//                             with debit(kind 'usage_tool_call') every 5 s or
//                             every 100 calls, so the proxy never waits on a
//                             DB write and the ledger gets one row per user
//                             per flush instead of one per call.
//   checkCallBurst(userId)    the per-minute abuse limiter (600/min/user by
//                             default). In-process, so it works while Upstash
//                             Redis is down; with several instances each one
//                             counts its own share (it only guards abuse).
//
// Idempotency: every flushed batch gets the key
// `calls:<userId>:<processId>:<seq>`, minted once with its amount. A failed
// debit is retried with the SAME key and amount, so a debit that committed but
// whose answer was lost is never charged twice (the ledger answers
// applied=false on a duplicate key). The process id carries a random part, so
// a restarted process never reuses an earlier process's keys.
//
// Residual risk, by design: a hard crash loses at most the calls of the last
// flush window (<= 5 s / 100 calls). A graceful exit flushes (beforeExit,
// SIGTERM, SIGINT) on a best-effort basis.

import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { debit, hasCredit } from "@/lib/wallet/ledger";
import { PRICING, eurToMicros, priceToolCallsMicros } from "@/lib/wallet/pricing";
import { afterBalanceChange } from "@/lib/wallet/after-debit";

/** Flush the accumulator at least this often. */
export const CALL_FLUSH_INTERVAL_MS = 5_000;
/** ... or as soon as this many calls are pending (all users together). */
export const CALL_FLUSH_MAX_CALLS = 100;
/** A batch whose debit keeps failing is retried for about an hour, then reported and dropped. */
export const CALL_FLUSH_MAX_ATTEMPTS = 720;
/** The ledger kind of a tool-call charge. */
export const TOOL_CALL_DEBIT_KIND = "usage_tool_call";

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** Tool calls per user per minute before the proxy answers 429 (env MCP_CALLS_PER_MINUTE). */
export const CALLS_PER_MINUTE = positiveInt(process.env.MCP_CALLS_PER_MINUTE, 600);

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------

/** What debit() answers (lib/wallet/ledger.ts, contract W1). */
export interface CallDebitResult {
  applied: boolean;
  totalMicros: number | bigint;
  crossedZero: boolean;
  crossedThreshold: boolean;
}

export interface CallDebitArgs {
  userId: string;
  amountMicros: number;
  kind: typeof TOOL_CALL_DEBIT_KIND;
  idempotencyKey: string;
  units: { calls: number };
  note?: string;
}

export interface CallMeterDeps {
  debit: (args: CallDebitArgs) => Promise<CallDebitResult>;
  /** Integer micro-euros for `calls` tool calls. */
  priceToolCallsMicros: (calls: number) => number;
  /** Fired (never awaited) after an applied debit: auto-recharge, wallet emails. */
  afterBalanceChange?: (userId: string, result: CallDebitResult) => unknown;
  /** Unique per process run: part of every idempotency key. */
  processId: string;
  flushIntervalMs?: number;
  maxPendingCalls?: number;
  maxAttempts?: number;
  /** Reports a failed or abandoned batch (default: console + Sentry). */
  onError?: (err: unknown, batch: PendingBatch, abandoned: boolean) => void;
}

/** One debit to make: its key and amount are fixed once minted. */
export interface PendingBatch {
  userId: string;
  calls: number;
  amountMicros: number;
  idempotencyKey: string;
  attempts: number;
}

export interface CallMeter {
  /** Count `calls` charged tool calls for `userId`. Synchronous, never throws. */
  record(userId: string, calls?: number): void;
  /** Debit everything pending (and retry failed batches). Never rejects. */
  flush(): Promise<void>;
  /** Calls counted but not yet debited (failed batches included). */
  pendingCalls(): number;
  /** Cancel the scheduled flush (tests). */
  stop(): void;
}

export function createCallMeter(deps: CallMeterDeps): CallMeter {
  const interval = deps.flushIntervalMs ?? CALL_FLUSH_INTERVAL_MS;
  const maxPending = deps.maxPendingCalls ?? CALL_FLUSH_MAX_CALLS;
  const maxAttempts = deps.maxAttempts ?? CALL_FLUSH_MAX_ATTEMPTS;
  const pending = new Map<string, number>();
  let retries: PendingBatch[] = [];
  let pendingTotal = 0;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const inFlight = new Set<Promise<void>>();

  const report =
    deps.onError ??
    ((err: unknown, batch: PendingBatch, abandoned: boolean) => {
      console.error(
        `[call-meter] debit ${abandoned ? "abandoned" : "failed, will retry"} (${batch.idempotencyKey}, ${batch.calls} calls):`,
        err
      );
      Sentry.captureException(err, {
        level: abandoned ? "fatal" : "error",
        tags: { area: "wallet", stage: "call-meter-flush" },
        extra: { ...batch, abandoned },
      });
    });

  function schedule(): void {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, interval);
    // Never keep the event loop alive just for a pending flush.
    timer.unref?.();
  }

  function record(userId: string, calls = 1): void {
    if (!userId || !Number.isFinite(calls) || calls <= 0) return;
    const n = Math.floor(calls);
    if (n <= 0) return;
    pending.set(userId, (pending.get(userId) ?? 0) + n);
    pendingTotal += n;
    if (pendingTotal >= maxPending) void flush();
    else schedule();
  }

  async function settle(batch: PendingBatch): Promise<void> {
    try {
      const result = await deps.debit({
        userId: batch.userId,
        amountMicros: batch.amountMicros,
        kind: TOOL_CALL_DEBIT_KIND,
        idempotencyKey: batch.idempotencyKey,
        units: { calls: batch.calls },
      });
      // applied=false: this key was already debited (a retry of a debit that
      // committed): nothing more to do.
      if (result.applied && deps.afterBalanceChange) {
        try {
          void Promise.resolve(deps.afterBalanceChange(batch.userId, result)).catch(() => {});
        } catch {
          // fire-and-forget: never fails the flush
        }
      }
    } catch (err) {
      const next = { ...batch, attempts: batch.attempts + 1 };
      const abandoned = next.attempts >= maxAttempts;
      report(err, next, abandoned);
      if (!abandoned) {
        retries.push(next);
        schedule();
      }
    }
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    // Snapshot: calls recorded while this flush runs go to the next one.
    const batches = retries;
    retries = [];
    for (const [userId, calls] of pending) {
      const amountMicros = Math.max(0, Math.round(deps.priceToolCallsMicros(calls)));
      seq += 1;
      if (amountMicros === 0) continue; // free calls (price set to 0): no ledger row
      batches.push({
        userId,
        calls,
        amountMicros,
        idempotencyKey: `calls:${userId}:${deps.processId}:${seq}`,
        attempts: 0,
      });
    }
    pending.clear();
    pendingTotal = 0;

    const run = Promise.all(batches.map(settle)).then(() => undefined);
    inFlight.add(run);
    try {
      // Also wait for flushes already running, so `await flush()` means
      // "everything recorded so far has been attempted" (exit hooks, tests).
      await Promise.all([...inFlight]);
    } finally {
      inFlight.delete(run);
    }
  }

  return {
    record,
    flush,
    pendingCalls: () => pendingTotal + retries.reduce((sum, b) => sum + b.calls, 0),
    stop: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Per-minute abuse limiter
// ---------------------------------------------------------------------------

export interface BurstVerdict {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window ends. */
  reset: number;
}

export interface BurstLimiter {
  check(userId: string, now?: number): BurstVerdict;
  reset(): void;
}

/** A fixed one-minute window per user, in memory, bounded. */
export function createBurstLimiter(limit: number, windowMs = 60_000): BurstLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  const MAX_TRACKED = 10_000;
  return {
    check(userId: string, now = Date.now()): BurstVerdict {
      const start = now - (now % windowMs);
      const reset = start + windowMs;
      let w = windows.get(userId);
      if (!w || w.start !== start) {
        if (windows.size >= MAX_TRACKED) {
          for (const [k, v] of windows) if (v.start !== start) windows.delete(k);
        }
        w = { start, count: 0 };
        windows.set(userId, w);
      }
      if (w.count >= limit) return { ok: false, limit, remaining: 0, reset };
      w.count += 1;
      return { ok: true, limit, remaining: limit - w.count, reset };
    },
    reset: () => windows.clear(),
  };
}

// ---------------------------------------------------------------------------
// Process singletons (the proxy routes use these)
// ---------------------------------------------------------------------------

/** This process run, in every idempotency key it mints. */
export const CALL_METER_PROCESS_ID = `${typeof process !== "undefined" ? process.pid : 0}-${randomUUID().slice(0, 8)}`;

const meter = createCallMeter({
  // Usage never takes the balance below the published overdraft.
  debit: (args) => debit({ ...args, floorMicros: eurToMicros(PRICING.overdraftEur) }),
  priceToolCallsMicros,
  // debit() has no side effects: the caller hands its result to the
  // follow-ups (auto-recharge, wallet emails) — lib/wallet/after-debit.ts.
  afterBalanceChange: (userId, result) =>
    afterBalanceChange(userId, { ...result, kind: TOOL_CALL_DEBIT_KIND }),
  processId: CALL_METER_PROCESS_ID,
});

const burst = createBurstLimiter(CALLS_PER_MINUTE);

let exitHooksInstalled = false;
let exitDeferred = false;

/** Flush, but never hold an exit for more than 3 s. */
function flushCapped(): Promise<unknown> {
  return Promise.race([meter.flush(), new Promise((r) => setTimeout(r, 3_000))]);
}

/**
 * Next.js (start-server) handles SIGTERM itself: it drains open requests, then
 * calls process.exit(0). Calls charged during that drain, or a flush still in
 * flight, would be lost; so the first exit after a signal waits for one last
 * flush (3 s at most). The worst case left is a hard kill: at most one 5 s /
 * 100-call window (about EUR 0.01 at default prices).
 */
function deferExitUntilFlushed(): void {
  if (exitDeferred) return;
  exitDeferred = true;
  const realExit = process.exit.bind(process);
  process.exit = ((code?: number | string | null) => {
    void flushCapped().finally(() => realExit(code ?? undefined));
    return undefined as never;
  }) as typeof process.exit;
}

/**
 * Flush on a graceful exit, best effort. A SIGTERM / SIGINT listener disables
 * Node's default exit, so when ours is the only one the process exits once the
 * flush has settled (3 s at most); when another handler exists (Next.js
 * standalone installs one) that handler keeps deciding when to exit, and its
 * process.exit waits for a final flush (deferExitUntilFlushed).
 */
function installExitHooks(): void {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  if (typeof process === "undefined" || typeof process.once !== "function") return;
  if (process.env.VITEST) return;
  process.once("beforeExit", () => {
    void meter.flush();
  });
  for (const [signal, code] of [
    ["SIGTERM", 143],
    ["SIGINT", 130],
  ] as const) {
    process.prependListener(signal, () => {
      const alone = process.listenerCount(signal) <= 1;
      if (alone) {
        void flushCapped().then(() => process.exit(code));
      } else {
        void meter.flush();
        deferExitUntilFlushed();
      }
    });
  }
}

/** Charge one tool call that reached the upstream MCP. Synchronous, never throws. */
export function chargeToolCall(userId: string): void {
  try {
    installExitHooks();
    meter.record(userId, 1);
  } catch (err) {
    console.error("[call-meter] record failed:", err);
  }
}

/** Debit everything pending now (shutdown hooks, tests, admin tooling). */
export function flushCallMeter(): Promise<void> {
  return meter.flush();
}

/**
 * The wallet gate: may this user's tool call be forwarded? Fails CLOSED — a
 * ledger error answers false (contract: money logic never fails open).
 */
export async function walletAllowsCall(userId: string): Promise<boolean> {
  try {
    return (await hasCredit(userId)) === true;
  } catch (err) {
    console.error("[call-meter] credit check failed (refusing the call):", err);
    Sentry.captureException(err, { tags: { area: "wallet", stage: "credit-gate" } });
    return false;
  }
}

/** The per-minute abuse limiter for one tool call (counts it when allowed). */
export function checkCallBurst(userId: string): BurstVerdict {
  return burst.check(userId);
}

/** Forget the limiter's windows (tests). */
export function resetCallBurst(): void {
  burst.reset();
}
