import * as Sentry from "@sentry/nextjs";
import type { Plan } from "@/db/schema";
import { trackServer } from "@/lib/analytics/server";
import { CREDIT_TOPUP_URL } from "@/lib/errors";
import { notifyWalletState } from "@/lib/wallet/notify";
import { emitWebhookEvent } from "@/lib/webhooks/emit";

export { emailNudgesEnabled } from "@/lib/billing/nudge-state";

/**
 * What happens when the MCP proxy refuses a tool call for an empty wallet
 * (HTTP 402, contract W2). Since 2026-10-29 there are no daily quotas and no
 * quota-limit email: the "you hit the wall" message is now the wallet's
 * zero-balance email, sent by lib/wallet/notify.ts (contract W5), which dedups
 * it per zero-balance episode in wallet_accounts.notified and always sends it
 * (money-critical, not a marketing nudge).
 *
 * Fire-and-forget: the caller does `void notifyCreditExhausted(...)` and never
 * awaits it. Nothing here may throw or slow the response. An LLM tool loop can
 * hit the 402 hundreds of times a minute, so a per-process claim (one per user
 * per UTC day; prod runs a single container) keeps that to one notify call,
 * one `quota.reached` webhook and one `credit_exhausted` event a day.
 */

const DAY_MS = 86_400_000;
const PLACEHOLDER_SUFFIX = "@placeholder.twinmcp.fr";

let claimedDay = -1;
const claimedToday = new Set<string>();

/** Claim today's notification for `userId`; false when already claimed in this process. */
function claimToday(userId: string, now: number): boolean {
  const epochDay = Math.floor(now / DAY_MS);
  if (epochDay !== claimedDay) {
    claimedDay = epochDay;
    claimedToday.clear();
  }
  if (claimedToday.has(userId)) return false;
  claimedToday.add(userId);
  return true;
}

/** Forget the per-process claims (tests). */
export function resetCreditNudgeClaims(): void {
  claimedDay = -1;
  claimedToday.clear();
}

/** Real, deliverable address (sign-up rows without a known email get a placeholder). */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return !!email && !email.endsWith(PLACEHOLDER_SUFFIX);
}

/**
 * A billable tool call was refused because the wallet is empty: tell the user
 * (zero-balance email, deduped by notify.ts), fire the `quota.reached` webhook
 * with reason `credit_exhausted`, and count the event. At most once per user
 * per UTC day per process. Never throws.
 */
export async function notifyCreditExhausted(
  userId: string,
  plan: Plan,
  now: number = Date.now()
): Promise<void> {
  if (!userId || !claimToday(userId, now)) return;

  // Never throws (emitWebhookEvent is fire-and-forget and catches everything).
  try {
    emitWebhookEvent(userId, "quota.reached", {
      reason: "credit_exhausted",
      plan,
      topupUrl: CREDIT_TOPUP_URL,
    });
  } catch (err) {
    console.warn("[credit-nudge] webhook skipped:", err);
  }
  try {
    trackServer({
      event: "credit_exhausted",
      distinctId: userId,
      properties: { plan },
    });
  } catch {
    // analytics never matters more than the response
  }

  try {
    await notifyWalletState(userId, "zero_balance", { source: "proxy_402" });
  } catch (err) {
    // Release the claim so a later refusal can try again.
    claimedToday.delete(userId);
    console.warn("[credit-nudge] zero-balance notification skipped:", err);
    Sentry.captureException(err, { tags: { area: "wallet", stage: "credit-nudge" } });
  }
}
