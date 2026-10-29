import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type Plan } from "@/db/schema";
import { getRedis } from "@/lib/redis";
import { sendQuotaLimitEmail } from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";
import { PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";
import { nextUtcMidnight } from "@/lib/billing/upgrade-state";
import { emailNudgesEnabled, stampNudge, withinNudgeCooldown } from "@/lib/billing/nudge-state";
import { emitWebhookEvent } from "@/lib/webhooks/emit";

export { emailNudgesEnabled } from "@/lib/billing/nudge-state";

/**
 * Quota-limit email, fired from the MCP proxy's 429 path.
 *
 * Fire-and-forget: the caller does `void notifyQuotaLimit(...)` and never
 * awaits it. Nothing here may throw or slow the response — every failure is
 * caught, logged and reported. Order matters: the claim comes FIRST (a
 * per-process set, then Redis) so that a burst of rejected requests (an LLM
 * tool loop) costs one DB read a day, not one per request. The email itself
 * is then subject to the global floor shared with the daily job
 * (users.metadata.nudges, lib/billing/nudge-state.ts): at most one nudge
 * email per Free account per NUDGE_COOLDOWN_DAYS, and it stamps that state.
 */

const DAY_MS = 86_400_000;
const DAY_SEC = 86_400;
const PLACEHOLDER_SUFFIX = "@placeholder.twinmcp.fr";

// Per-process memory of today's claims. Every rejected request in a tool loop
// would otherwise cost one Upstash command (SET NX); prod runs a single
// container, so this short-circuits all but the first 429 per user per UTC
// day. Redis stays the cross-process gate. Bounded: reset when the day turns.
let claimedDay = -1;
const claimedToday = new Set<string>();

function alreadyClaimedLocally(userId: string, epochDay: number): boolean {
  if (epochDay !== claimedDay) {
    claimedDay = epochDay;
    claimedToday.clear();
  }
  return claimedToday.has(userId);
}

/** Forget the per-process claims (tests). */
export function resetQuotaNudgeClaims(): void {
  claimedDay = -1;
  claimedToday.clear();
  webhookDay = -1;
  webhookSentToday.clear();
}

/** Real, deliverable address (sign-up rows without a known email get a placeholder). */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return !!email && !email.endsWith(PLACEHOLDER_SUFFIX);
}

// quota.reached webhook (lib/webhooks/emit.ts): at most once per user per UTC
// day per process, on every plan. Kept apart from the email claim above, which
// needs Redis — the webhook must still fire while Redis is down.
let webhookDay = -1;
const webhookSentToday = new Set<string>();

function emitQuotaReachedOnce(userId: string, plan: Plan, rl: { limit: number; reset: number }) {
  const epochDay = Math.floor(Date.now() / DAY_MS);
  if (epochDay !== webhookDay) {
    webhookDay = epochDay;
    webhookSentToday.clear();
  }
  if (webhookSentToday.has(userId)) return;
  webhookSentToday.add(userId);
  emitWebhookEvent(userId, "quota.reached", {
    plan,
    limit: rl.limit,
    resetsAt: (rl.reset > 0 ? new Date(rl.reset) : nextUtcMidnight(new Date())).toISOString(),
  });
}

export async function notifyQuotaLimit(
  userId: string,
  plan: Plan,
  rl: { limit: number; reset: number }
): Promise<void> {
  // Never throws (emitWebhookEvent is fire-and-forget and catches everything).
  emitQuotaReachedOnce(userId, plan, rl);

  // Paid plans get no upsell; their 429 already says to contact us.
  if (plan !== "free") return;

  try {
    // Dedup first: one email per user per UTC day, claimed atomically.
    const epochDay = Math.floor(Date.now() / DAY_MS);
    if (alreadyClaimedLocally(userId, epochDay)) return;
    const claimed = await getRedis().set(`nudge:quota-email:${userId}:${epochDay}`, 1, {
      nx: true,
      ex: DAY_SEC,
    });
    claimedToday.add(userId);
    if (claimed === null) return; // already sent today

    const [u] = await getDb()
      .select({
        email: users.email,
        metadata: users.metadata,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u || !isDeliverableEmail(u.email)) return;
    if (!emailNudgesEnabled(u.metadata)) return;
    // The global floor shared with the daily job: whichever sender fired last,
    // the account hears nothing more for NUDGE_COOLDOWN_DAYS.
    const now = new Date();
    if (withinNudgeCooldown(u.metadata, now)) return;

    await sendQuotaLimitEmail(u.email, {
      used: rl.limit,
      limit: rl.limit,
      resetsAt: rl.reset > 0 ? new Date(rl.reset) : nextUtcMidnight(new Date()),
      // The free month only comes with a FIRST subscription: an existing Stripe
      // customer has used it.
      trialDays: u.stripeCustomerId ? 0 : PRO_TRIAL_DAYS,
      proDailyLimit: getDailyLimit("pro"),
    });
    // Stamp users.metadata.nudges so the job's cooldown / 14-day quota repeat
    // can see this send (a failed stamp is reported; Redis still holds today).
    await stampNudge(getDb(), userId, u.metadata, "quota_limit", now);

    trackServer({
      event: "upgrade_email_sent",
      distinctId: userId,
      properties: { kind: "quota_limit", reason: "quota_limit" },
    });
  } catch (err) {
    console.warn("[upgrade-nudge] quota-limit email skipped:", err);
    Sentry.captureException(err, { tags: { area: "upgrade-nudge", stage: "quota-email" } });
  }
}
