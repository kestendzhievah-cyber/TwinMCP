import type { LedgerKind } from "@/db/schema/wallet";

// Follow-ups of a balance change (contract W1 → W3 / W5). A caller that
// applied a debit (tool-call flush, compute metering, clawback) passes the
// result here; when the balance crossed the low-balance threshold or zero this
// fires, in the background and never throwing:
//   1. maybeAutoRecharge(userId)   (lib/wallet/auto-recharge.ts, W3)
//   2. notifyWalletState(userId, "zero_balance" | "low_balance")
//      (lib/wallet/notify.ts, W5), skipped when step 1 brought the balance
//      back above the line, so nobody is told "you are out of credit" right
//      after their card was charged.
// The W3/W5 modules are loaded lazily: they import the ledger, which imports
// this file, and a lazy import keeps that cycle out of module evaluation.

export type WalletNotifyEvent =
  | "signup_credit_granted"
  | "low_balance"
  | "zero_balance"
  | "promo_expiring_7d"
  | "promo_expiring_2d"
  | "auto_recharge_failed"
  | "runtime_deletion_warning"
  | "subscription_converted"
  | "topup_succeeded";

export interface BalanceChange {
  applied?: boolean;
  totalMicros: number | bigint;
  crossedZero: boolean;
  crossedThreshold: boolean;
  /** Ledger kind that caused the change, passed on to the notification. */
  kind?: LedgerKind;
}

export interface FollowUps {
  autoRecharge: boolean;
  notify: "zero_balance" | "low_balance" | null;
}

/** What a balance change calls for. Zero wins over low balance. Pure. */
export function followUpsFor(change: BalanceChange): FollowUps {
  if (change.applied === false) return { autoRecharge: false, notify: null };
  if (change.crossedZero) return { autoRecharge: true, notify: "zero_balance" };
  if (change.crossedThreshold) return { autoRecharge: true, notify: "low_balance" };
  return { autoRecharge: false, notify: null };
}

export interface AfterDeps {
  maybeAutoRecharge: (userId: string) => Promise<void>;
  notifyWalletState: (
    userId: string,
    event: WalletNotifyEvent,
    data?: Record<string, unknown>
  ) => Promise<void>;
  /** Fresh balance and threshold, read after the auto-recharge attempt. */
  readWallet: (userId: string) => Promise<{ totalMicros: number; thresholdMicros: number }>;
  log?: (msg: string, err: unknown) => void;
}

/** The follow-up chain with injected dependencies (tested directly). Never rejects. */
export async function runFollowUps(
  deps: AfterDeps,
  userId: string,
  change: BalanceChange
): Promise<void> {
  const log = deps.log ?? ((msg, err) => console.error(msg, err));
  const plan = followUpsFor(change);
  if (!plan.autoRecharge && !plan.notify) return;

  let recharged = false;
  if (plan.autoRecharge) {
    try {
      await deps.maybeAutoRecharge(userId);
      recharged = true;
    } catch (err) {
      log(`[wallet] auto-recharge failed for ${userId}`, err);
    }
  }
  if (!plan.notify) return;

  if (recharged) {
    try {
      const w = await deps.readWallet(userId);
      const line = plan.notify === "zero_balance" ? 0 : w.thresholdMicros;
      if (w.totalMicros > line) return; // topped up in the meantime
    } catch (err) {
      log(`[wallet] balance re-read failed for ${userId}`, err);
    }
  }
  try {
    await deps.notifyWalletState(userId, plan.notify, {
      totalMicros: Number(change.totalMicros),
      ...(change.kind ? { kind: change.kind } : {}),
    });
  } catch (err) {
    log(`[wallet] ${plan.notify} notification failed for ${userId}`, err);
  }
}

const liveDeps: AfterDeps = {
  maybeAutoRecharge: async (userId) => {
    const m = await import("./auto-recharge");
    await m.maybeAutoRecharge(userId);
  },
  notifyWalletState: async (userId, event, data) => {
    const m = await import("./notify");
    await m.notifyWalletState(userId, event, data);
  },
  readWallet: async (userId) => {
    const m = await import("./ledger");
    const w = await m.getWallet(userId);
    return { totalMicros: w.totalMicros, thresholdMicros: w.autoRecharge.thresholdMicros };
  },
};

/**
 * Fire-and-forget follow-ups of an applied debit (or promo expiry). Returns
 * immediately; never throws. Call it once per debit() result.
 */
export function afterBalanceChange(userId: string, change: BalanceChange): void {
  if (!followUpsFor(change).autoRecharge) return;
  void runFollowUps(liveDeps, userId, change).catch(() => {});
}

/** Fire-and-forget wallet notification (W5), e.g. promo expiry reminders. Never throws. */
export function notifyWallet(
  userId: string,
  event: WalletNotifyEvent,
  data?: Record<string, unknown>
): void {
  void liveDeps
    .notifyWalletState(userId, event, data)
    .catch((err) => console.error(`[wallet] ${event} notification failed for ${userId}`, err));
}
