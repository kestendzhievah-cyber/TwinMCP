import type { Plan } from "@/db/schema/core";

/**
 * Formerly: enforce a downgraded plan's runtime limits when a subscription
 * ended, destroying the boxes of servers over the Free quota.
 *
 * Since the prepaid wallet (2026-10-29) billing NEVER downgrades a plan and
 * never stops or destroys a runtime: users.plan only records "funded" ('pro')
 * vs not ('free'), and compute is limited by the wallet balance instead. The
 * wallet-enforce cron pauses boxes when the balance reaches zero, and only
 * ever deletes the runtimes of never-funded accounts after a 14-day warning
 * (lib/wallet/compute-meter.ts).
 *
 * Kept as a no-op so existing callers (the Stripe webhook) keep compiling and
 * a subscription ending can no longer cost a user their servers.
 */
export async function reconcileServersForPlan(
  userId: string,
  plan: Plan
): Promise<{ stopped: string[] }> {
  console.info(
    `[reconcile] plan '${plan}' for ${userId}: no runtime change (billing no longer downgrades)`
  );
  return { stopped: [] };
}
