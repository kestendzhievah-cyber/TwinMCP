import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { users } from "@/db/schema";

/**
 * users.metadata.nudges — the shared memory of the account-level nudge emails:
 * the activation reminder (lib/billing/nudge-job.ts) and, until the proxy
 * stops sending it, the legacy quota-limit email (lib/billing/quota-nudge.ts).
 * No table, no migration: a top-level jsonb merge leaves emailNudges and the
 * other metadata keys untouched.
 *
 *   { lastEmailAt, offerAt, quotaLimitAt, activationAt }   ISO timestamps
 *
 * Whichever sender fires, an account gets at most ONE such email per
 * NUDGE_COOLDOWN_DAYS. Wallet notices (low balance, promo expiring, ...) are
 * deduped separately, in wallet_accounts.notified (lib/wallet/notify.ts), and
 * only share emailNudgesEnabled() with these.
 */

/** "offer" and "quota_limit" are legacy (Free → Pro); only "activation" is still sent by the job. */
export type NudgeKind = "offer" | "quota_limit" | "activation";

/** The users.metadata.nudges key that records when each kind was last sent. */
export const NUDGE_STAMP_KEYS: Record<NudgeKind, "offerAt" | "quotaLimitAt" | "activationAt"> = {
  offer: "offerAt",
  quota_limit: "quotaLimitAt",
  activation: "activationAt",
};

/** Global floor between two nudge emails to the same account. */
export const NUDGE_COOLDOWN_DAYS = 7;

const DAY_MS = 86_400_000;

export interface NudgeState {
  lastEmailAt?: unknown;
  offerAt?: unknown;
  quotaLimitAt?: unknown;
  activationAt?: unknown;
  [key: string]: unknown;
}

/** A stored timestamp, or null when absent / malformed (never throws). */
export function parseNudgeDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * users.metadata.emailNudges — ABSENT means opted in (contract: only an
 * explicit `false`, set by PATCH /api/v2/users/me/preferences, opts out).
 */
export function emailNudgesEnabled(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return true;
  return (metadata as Record<string, unknown>).emailNudges !== false;
}

/**
 * users.metadata.firstToolCallAt — stamped once by the relay (lib/mcp/relay.ts)
 * on the account's first successful tools/call. null when absent / malformed.
 */
export function firstToolCallAt(metadata: unknown): Date | null {
  if (!metadata || typeof metadata !== "object") return null;
  return parseNudgeDate((metadata as Record<string, unknown>).firstToolCallAt);
}

/** The `nudges` object, or {} when absent / malformed. */
export function nudgeState(metadata: unknown): NudgeState {
  const n =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).nudges
      : undefined;
  return n && typeof n === "object" && !Array.isArray(n) ? (n as NudgeState) : {};
}

/** True while the account is inside the global cooldown after its last nudge email. */
export function withinNudgeCooldown(metadata: unknown, now: Date): boolean {
  const last = parseNudgeDate(nudgeState(metadata).lastEmailAt);
  return !!last && now.getTime() - last.getTime() < NUDGE_COOLDOWN_DAYS * DAY_MS;
}

/** The merged `nudges` object after a `kind` email sent at `now`. */
export function stampedNudgeState(metadata: unknown, kind: NudgeKind, now: Date): NudgeState {
  const iso = now.toISOString();
  return {
    ...nudgeState(metadata),
    lastEmailAt: iso,
    [NUDGE_STAMP_KEYS[kind]]: iso,
  };
}

type Db = ReturnType<typeof getDb>;

/**
 * users.metadata = COALESCE(metadata, '{}') || {"nudges": {...existing, lastEmailAt, offerAt | quotaLimitAt | activationAt}}
 * Top-level merge (same pattern as /api/v2/users/me/onboarding), so the other
 * metadata keys — emailNudges included — are left untouched.
 */
export async function stampNudge(
  db: Db,
  userId: string,
  metadata: unknown,
  kind: NudgeKind,
  now: Date
): Promise<void> {
  const nudges = stampedNudgeState(metadata, kind, now);
  await db
    .update(users)
    .set({
      metadata: sql`COALESCE(${users.metadata}, '{}'::jsonb) || ${JSON.stringify({ nudges })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
