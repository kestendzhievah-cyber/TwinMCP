import * as Sentry from "@sentry/nextjs";
import { and, count, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, users } from "@/db/schema";
import { creditLedger, walletAccounts } from "@/db/schema/wallet";
import { emailNudgesEnabled } from "@/lib/billing/nudge-state";
import { formatCredit, RUNTIME_DELETION_AFTER_DAYS } from "@/lib/billing/upgrade-state";
import { PRICING, eurToMicros, publicPriceTable, whatTenEuroBuys } from "@/lib/wallet/pricing";
import {
  sendAutoRechargeFailedEmail,
  sendLowBalanceEmail,
  sendPromoExpiringEmail,
  sendRuntimeDeletionWarningEmail,
  sendSignupCreditEmail,
  sendSubscriptionConvertedEmail,
  sendTopupSucceededEmail,
  sendZeroBalanceEmail,
} from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";
import type { WalletNotifyEvent } from "./after-debit";

/**
 * Wallet emails (contract W5): `notifyWalletState(userId, event, data?)`.
 *
 * Fire-and-forget from the ledger follow-ups (lib/wallet/after-debit.ts), the
 * Stripe webhook, the sign-up grant, the conversion script and the daily
 * reminder job. It never throws and never sends the same notice twice:
 *
 *  - dedupe state lives in wallet_accounts.notified ({ [key]: { at, ref? } }),
 *    claimed with a compare-and-swap UPDATE BEFORE the email goes out, so two
 *    concurrent triggers (a flush and the cron) send one email; a failed send
 *    puts the previous stamp back so the next trigger retries;
 *  - users.metadata.emailNudges=false silences the nudges (sign-up credit, low
 *    balance, promo expiring) but never the money-critical notices (zero
 *    balance, failed auto-recharge, runtime deletion, subscription conversion)
 *    nor the top-up receipt;
 *  - a stale trigger is dropped (low balance when the balance is back up, a
 *    promo reminder once the promo is spent, ...).
 *
 * Dedupe rules per event (decideWalletNotification, pure and tested):
 *  - once      signup_credit_granted: one email per account, ever
 *  - episode   low_balance, zero_balance: again only after money came in
 *              (a ledger credit newer than the last email)
 *  - ref       promo_expiring_7d/2d (ref = the promo expiry),
 *              runtime_deletion_warning (one key per stage, ref = the zero
 *              episode), subscription_converted (ref = the subscription),
 *              topup_succeeded (ref = the Stripe session / payment; without
 *              a ref every call sends: the webhook only notifies an applied credit)
 *  - cooldown  auto_recharge_failed: at most one per day
 */

export type WalletEvent = WalletNotifyEvent;

/** Always sent, whatever users.metadata.emailNudges says. */
export const MONEY_CRITICAL_EVENTS: ReadonlySet<WalletEvent> = new Set<WalletEvent>([
  "zero_balance",
  "auto_recharge_failed",
  "runtime_deletion_warning",
  "subscription_converted",
  // A payment receipt is transactional, not marketing.
  "topup_succeeded",
]);

type Scope = "once" | "episode" | "ref" | "cooldown";

const DAY_MS = 86_400_000;

export const NOTIFY_POLICY: Record<WalletEvent, { scope: Scope; cooldownMs?: number }> = {
  signup_credit_granted: { scope: "once" },
  low_balance: { scope: "episode" },
  zero_balance: { scope: "episode" },
  promo_expiring_7d: { scope: "ref" },
  promo_expiring_2d: { scope: "ref" },
  auto_recharge_failed: { scope: "cooldown", cooldownMs: DAY_MS },
  runtime_deletion_warning: { scope: "ref" },
  subscription_converted: { scope: "ref" },
  topup_succeeded: { scope: "ref" },
};

/** Stages of the runtime deletion warning: days since the balance hit zero. */
export const DELETION_WARNING_STAGES = [0, 7, 13] as const;

export interface NotifyStamp {
  at: string;
  ref?: string;
}

const PLACEHOLDER_SUFFIX = "@placeholder.twinmcp.fr";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A stored stamp, tolerant of a bare ISO string (older shape) and junk. */
export function readStamp(notified: unknown, key: string): NotifyStamp | null {
  if (!isRecord(notified)) return null;
  const raw = notified[key];
  if (typeof raw === "string") return parseDate(raw) ? { at: raw } : null;
  if (isRecord(raw) && typeof raw.at === "string" && parseDate(raw.at)) {
    return typeof raw.ref === "string" ? { at: raw.at, ref: raw.ref } : { at: raw.at };
  }
  return null;
}

/** The notified-map key of an event: one per deletion stage, else the event name. */
export function notifyKey(event: WalletEvent, data: Record<string, unknown> = {}): string {
  if (event === "runtime_deletion_warning") return `runtime_deletion_warning:${stageOf(data)}`;
  return event;
}

function stageOf(data: Record<string, unknown>): number {
  const n = Number(data.stage);
  return (DELETION_WARNING_STAGES as readonly number[]).includes(n) ? n : 0;
}

export interface NotifyDecisionInput {
  notified: unknown;
  event: WalletEvent;
  key: string;
  /** The identity of what is being announced (see the rules above). */
  ref?: string | null;
  /** Newest positive ledger row (money in): ends a low/zero episode. */
  lastCreditAt?: Date | null;
  now: Date;
}

export interface NotifyDecision {
  send: boolean;
  previous: NotifyStamp | null;
  stamp: NotifyStamp;
  why: string;
}

/** Whether `event` should be emailed now, and the stamp that records it. Pure. */
export function decideWalletNotification(input: NotifyDecisionInput): NotifyDecision {
  const { event, key, now } = input;
  const policy = NOTIFY_POLICY[event];
  const previous = readStamp(input.notified, key);
  const ref = input.ref ?? null;
  const stamp: NotifyStamp = ref ? { at: now.toISOString(), ref } : { at: now.toISOString() };
  const out = (send: boolean, why: string): NotifyDecision => ({ send, previous, stamp, why });

  if (!previous) return out(true, "first");
  const prevAt = parseDate(previous.at) as Date;

  switch (policy.scope) {
    case "once":
      return out(false, "already sent");
    case "episode": {
      const credit = input.lastCreditAt ?? null;
      return credit && credit.getTime() > prevAt.getTime()
        ? out(true, "new episode after a credit")
        : out(false, "same episode");
    }
    case "ref":
      // No identity to compare (e.g. a receipt sent without its Stripe ref):
      // the caller already guarantees one call per event, so do not dedupe.
      if (!ref) return out(true, "no ref");
      return (previous.ref ?? null) === ref ? out(false, "same ref") : out(true, "new ref");
    case "cooldown":
      return now.getTime() - prevAt.getTime() >= (policy.cooldownMs ?? DAY_MS)
        ? out(true, "cooldown over")
        : out(false, "within cooldown");
  }
}

// ---- Context ----------------------------------------------------------------

export interface NotifyContext {
  email: string | null;
  metadata: unknown;
  funded: boolean;
  paidMicros: number;
  /** Unexpired promo credit. */
  promoMicros: number;
  promoExpiresAt: Date | null;
  zeroBalanceAt: Date | null;
  autoRechargeEnabled: boolean;
  notified: unknown;
  lastCreditAt: Date | null;
  serverCount: number;
}

/** Why a trigger is no longer true by the time it is handled (null = still true). Pure. */
export function staleReason(
  event: WalletEvent,
  ctx: NotifyContext,
  now: Date,
  data: Record<string, unknown> = {}
): string | null {
  const total = ctx.paidMicros + ctx.promoMicros;
  switch (event) {
    case "low_balance":
      return total <= 0 ? "balance at zero (zero_balance covers it)" : null;
    case "zero_balance":
      return total > 0 ? "balance positive again" : null;
    case "promo_expiring_7d":
    case "promo_expiring_2d":
      if (ctx.promoMicros <= 0) return "no promo credit left";
      if (!ctx.promoExpiresAt || ctx.promoExpiresAt.getTime() <= now.getTime()) {
        return "promo already expired";
      }
      return null;
    case "runtime_deletion_warning":
      if (ctx.funded) return "funded account";
      if (total > 0) return "balance positive again";
      if (!ctx.zeroBalanceAt && !parseDate(data.deleteAt)) return "no zero-balance episode";
      return null;
    default:
      return null;
  }
}

/** The dedupe ref of an event (see the rules in the header). */
export function refFor(
  event: WalletEvent,
  ctx: Pick<NotifyContext, "promoExpiresAt" | "zeroBalanceAt">,
  data: Record<string, unknown> = {}
): string | null {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  switch (event) {
    case "promo_expiring_7d":
    case "promo_expiring_2d":
      return ctx.promoExpiresAt ? ctx.promoExpiresAt.toISOString() : null;
    case "runtime_deletion_warning":
      return ctx.zeroBalanceAt?.toISOString() ?? str(data.deleteAt);
    case "subscription_converted":
      return str(data.subscriptionId) ?? str(data.stripeRef) ?? "conversion";
    case "topup_succeeded":
      return str(data.stripeRef) ?? str(data.sessionId) ?? str(data.paymentIntentId);
    default:
      return null;
  }
}

// ---- Delivery -----------------------------------------------------------------

function microsFrom(data: Record<string, unknown>, key: string): number | null {
  const n = Number(data[key]);
  return Number.isFinite(n) ? n : null;
}

/** Sends the email for `event`. Throws on failure (the caller releases the stamp). */
export async function deliverWalletEmail(
  event: WalletEvent,
  to: string,
  ctx: NotifyContext,
  data: Record<string, unknown>,
  now: Date
): Promise<void> {
  const total = ctx.paidMicros + ctx.promoMicros;
  const balance = formatCredit(total, { precise: false });
  switch (event) {
    case "signup_credit_granted": {
      const amount = microsFrom(data, "amountMicros") ?? ctx.promoMicros;
      const buys = whatTenEuroBuys();
      const table = publicPriceTable();
      return sendSignupCreditEmail(to, {
        amount: formatCredit(amount, { precise: false }),
        expiresAt: parseDate(data.expiresAt) ?? ctx.promoExpiresAt,
        examples: buys.examples.en,
        per1000Calls: formatCredit(eurToMicros(table.per1000CallsEur)),
        minTopup: formatCredit(eurToMicros(PRICING.minTopupEur), { precise: false }),
      });
    }
    case "low_balance":
      return sendLowBalanceEmail(to, {
        balance,
        autoRecharge: ctx.funded && ctx.autoRechargeEnabled,
      });
    case "zero_balance":
      return sendZeroBalanceEmail(to, {
        funded: ctx.funded,
        deleteAfterDays: ctx.funded ? null : RUNTIME_DELETION_AFTER_DAYS,
        // lib/wallet/ledger.ts expirePromos passes the ledger kind along.
        promoExpired: data.kind === "promo_expiry",
      });
    case "promo_expiring_7d":
    case "promo_expiring_2d": {
      const expiresAt = ctx.promoExpiresAt as Date;
      return sendPromoExpiringEmail(to, {
        remaining: formatCredit(ctx.promoMicros, { precise: false }),
        expiresAt,
        daysLeft: Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS)),
        funded: ctx.funded,
      });
    }
    case "auto_recharge_failed": {
      const amount = microsFrom(data, "amountMicros");
      return sendAutoRechargeFailedEmail(to, {
        amount: amount !== null ? formatCredit(amount, { precise: false }) : null,
        reason: typeof data.reason === "string" ? data.reason.slice(0, 200) : null,
      });
    }
    case "runtime_deletion_warning": {
      const deleteAt =
        parseDate(data.deleteAt) ??
        new Date((ctx.zeroBalanceAt ?? now).getTime() + RUNTIME_DELETION_AFTER_DAYS * DAY_MS);
      return sendRuntimeDeletionWarningEmail(to, {
        stage: stageOf(data),
        deleteAt,
        serverCount: Math.max(1, ctx.serverCount),
      });
    }
    case "subscription_converted": {
      const credited = microsFrom(data, "amountMicros") ?? 0;
      return sendSubscriptionConvertedEmail(to, {
        credited: formatCredit(credited, { precise: false }),
        plan: typeof data.plan === "string" && data.plan === "team" ? "Team" : "Pro",
        balance,
      });
    }
    case "topup_succeeded": {
      const amount = microsFrom(data, "amountMicros") ?? 0;
      return sendTopupSucceededEmail(to, {
        amount: formatCredit(amount, { precise: false }),
        balance,
      });
    }
  }
}

// ---- The entry point ----------------------------------------------------------

export interface NotifyDeps {
  loadContext(userId: string, now: Date): Promise<NotifyContext | null>;
  /** CAS: set notified[key]=stamp only if it still equals `previous`. True when claimed. */
  claim(
    userId: string,
    key: string,
    previous: NotifyStamp | null,
    stamp: NotifyStamp
  ): Promise<boolean>;
  /** Put `previous` back after a failed send (best effort). */
  release(userId: string, key: string, previous: NotifyStamp | null): Promise<void>;
  deliver: typeof deliverWalletEmail;
  track(userId: string, event: WalletEvent, why: string): void;
  report(err: unknown, userId: string, event: WalletEvent): void;
  hasMailer(): boolean;
}

export type NotifyOutcome =
  | "sent"
  | "deduped"
  | "stale"
  | "opted_out"
  | "undeliverable"
  | "no_mailer"
  | "no_user"
  | "lost_race"
  | "failed";

/** The decision chain with injected dependencies (tested directly). Never rejects. */
export async function notifyWith(
  deps: NotifyDeps,
  userId: string,
  event: WalletEvent,
  data: Record<string, unknown> = {},
  now: Date = new Date()
): Promise<NotifyOutcome> {
  try {
    const ctx = await deps.loadContext(userId, now);
    if (!ctx) return "no_user";
    const to = (ctx.email ?? "").trim();
    if (!to || to.endsWith(PLACEHOLDER_SUFFIX)) return "undeliverable";
    if (!MONEY_CRITICAL_EVENTS.has(event) && !emailNudgesEnabled(ctx.metadata)) {
      return "opted_out";
    }
    if (staleReason(event, ctx, now, data)) return "stale";

    const key = notifyKey(event, data);
    const decision = decideWalletNotification({
      notified: ctx.notified,
      event,
      key,
      ref: refFor(event, ctx, data),
      lastCreditAt: ctx.lastCreditAt,
      now,
    });
    if (!decision.send) return "deduped";
    if (!deps.hasMailer()) {
      console.warn(`[wallet/notify] RESEND_API_KEY not set: ${event} for ${userId} not sent`);
      return "no_mailer";
    }
    if (!(await deps.claim(userId, key, decision.previous, decision.stamp))) return "lost_race";

    try {
      await deps.deliver(event, to, ctx, data, now);
    } catch (err) {
      await deps.release(userId, key, decision.previous).catch(() => {});
      deps.report(err, userId, event);
      return "failed";
    }
    deps.track(userId, event, decision.why);
    return "sent";
  } catch (err) {
    deps.report(err, userId, event);
    return "failed";
  }
}

const liveDeps: NotifyDeps = {
  async loadContext(userId, now) {
    const db = getDb();
    const [[user], [wallet], [credit], [srv]] = await Promise.all([
      db
        .select({ email: users.email, metadata: users.metadata, plan: users.plan })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1),
      db
        .select({ at: sql<string | null>`max(${creditLedger.createdAt})::text` })
        .from(creditLedger)
        .where(and(eq(creditLedger.userId, userId), gt(creditLedger.deltaMicros, 0))),
      db
        .select({ n: count() })
        .from(servers)
        .where(and(eq(servers.userId, userId), ne(servers.status, "destroyed"))),
    ]);
    if (!user) return null;
    const expiresAt = wallet?.promoExpiresAt ?? null;
    const promoLive = !expiresAt || expiresAt.getTime() > now.getTime();
    return {
      email: user.email,
      metadata: user.metadata,
      funded: Boolean(wallet?.fundedAt) || user.plan === "pro" || user.plan === "team",
      paidMicros: Number(wallet?.paidMicros ?? 0),
      promoMicros: promoLive ? Number(wallet?.promoMicros ?? 0) : 0,
      promoExpiresAt: expiresAt,
      zeroBalanceAt: wallet?.zeroBalanceAt ?? null,
      autoRechargeEnabled: Boolean(wallet?.autoRechargeEnabled),
      notified: wallet?.notified ?? {},
      lastCreditAt: parseDate(credit?.at ?? null),
      serverCount: Number(srv?.n ?? 0),
    };
  },

  async claim(userId, key, previous, stamp) {
    const db = getDb();
    // The wallet row may not exist yet (a notice before any money moved).
    await db.insert(walletAccounts).values({ userId }).onConflictDoNothing();
    const rows = await db
      .update(walletAccounts)
      .set({
        notified: sql`coalesce(${walletAccounts.notified}, '{}'::jsonb) || jsonb_build_object(${key}::text, ${JSON.stringify(stamp)}::jsonb)`,
      })
      .where(
        and(
          eq(walletAccounts.userId, userId),
          previous
            ? sql`${walletAccounts.notified} -> ${key}::text = ${JSON.stringify(previous)}::jsonb`
            : sql`(${walletAccounts.notified} -> ${key}::text) is null`
        )
      )
      .returning({ userId: walletAccounts.userId });
    return rows.length > 0;
  },

  async release(userId, key, previous) {
    await getDb()
      .update(walletAccounts)
      .set({
        notified: previous
          ? sql`coalesce(${walletAccounts.notified}, '{}'::jsonb) || jsonb_build_object(${key}::text, ${JSON.stringify(previous)}::jsonb)`
          : sql`coalesce(${walletAccounts.notified}, '{}'::jsonb) - ${key}::text`,
      })
      .where(eq(walletAccounts.userId, userId));
  },

  deliver: deliverWalletEmail,

  track(userId, event, why) {
    trackServer({
      event: "wallet_email_sent",
      distinctId: userId,
      properties: { kind: event, why },
    });
  },

  report(err, userId, event) {
    console.warn(`[wallet/notify] ${event} for user ${userId} failed:`, err);
    Sentry.captureException(err, {
      tags: { area: "wallet-notify", event },
      extra: { userId },
    });
  },

  hasMailer: () => Boolean(process.env.RESEND_API_KEY),
};

/**
 * Contract W5. Emails `event` to the account when it is due (see the header).
 * Never throws; safe to `void`.
 */
export async function notifyWalletState(
  userId: string,
  event: WalletEvent,
  data?: Record<string, unknown>
): Promise<void> {
  await notifyWith(liveDeps, userId, event, data ?? {});
}

/** Same as notifyWalletState, returning what happened (the reminder job reports it). */
export function notifyWalletStateWithOutcome(
  userId: string,
  event: WalletEvent,
  data?: Record<string, unknown>,
  now?: Date
): Promise<NotifyOutcome> {
  return notifyWith(liveDeps, userId, event, data ?? {}, now);
}
