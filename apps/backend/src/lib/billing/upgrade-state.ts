import type { Plan } from "@/db/schema";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { formatEur, formatEurAmount, MICROS_PER_EUR, minTopupLabel } from "@/lib/wallet/pricing";

/**
 * Wallet nudges: one pure decision for every surface.
 *
 * TwinMCP is pay-as-you-go from a prepaid balance (lib/wallet/*). The
 * dashboard strip, the overview cards, the usage page, the nav pill and the
 * daily reminder job all need to answer the same question: "what should we
 * tell this account about its credit right now, and how loudly?". Keeping the
 * decision here (no DB, no env, no React) means one set of copy, one set of
 * thresholds, and a unit test per branch.
 *
 * Levels, from quiet to loud (the names predate the wallet and are kept so
 * every surface and the analytics events keep one vocabulary):
 *  - none      nothing to say
 *  - info      a legacy Pro/Team subscription that will be converted to credit
 *  - offer     the account runs on its free sign-up credit only (not funded):
 *              a first top-up unlocks the full product
 *  - trial     the free sign-up credit expires within PROMO_ALERT_DAYS
 *  - warning   balance below LOW_BALANCE_MICROS
 *  - limit     balance used up: tool calls are refused until a top-up
 *  - past_due  a legacy subscription whose last renewal failed
 *
 * Money is integer micro-euros (€1 = 1_000_000) everywhere; this module only
 * turns it into text.
 *
 * Client-safe: type imports, plan-features and the pure price list only.
 */

export type NudgeLevel = "none" | "info" | "offer" | "trial" | "warning" | "limit" | "past_due";

export type NudgeReason =
  | "none"
  | "promo_only"
  | "servers_limit"
  | "keys_limit"
  | "promo_expiring"
  | "low_balance"
  | "zero_balance"
  | "promo_cap"
  | "legacy_subscription"
  | "past_due";

/** Where a nudge was shown or clicked: the analytics `source` property. */
export type NudgeSource =
  | "banner"
  | "overview"
  | "servers"
  | "usage"
  | "marketplace"
  | "keys"
  | "nav"
  | "billing"
  | "email"
  | "proxy";

export interface WalletSignals {
  plan: Plan;
  /** False when the wallet could not be read: every surface then stays quiet. */
  walletAvailable: boolean;
  paidMicros: number;
  /** Unexpired promo credit (0 once expired). */
  promoMicros: number;
  promoExpiresAt: Date | string | null;
  /** A first paid top-up happened (wallet_accounts.funded_at). */
  funded: boolean;
  autoRechargeEnabled?: boolean;
  /** Servers not destroyed. */
  serverCount: number;
  /** Active API keys (optional: not every surface loads them). */
  keyCount?: number;
  /** Stripe subscription status mirrored on users.subscription_status (legacy plans). */
  subscriptionStatus?: string | null;
  /** users.stripe_subscription_id present: a legacy subscription still exists. */
  hasSubscription?: boolean;
  /**
   * The promo compute cap (lib/wallet/compute-meter.ts kill switch) paused
   * this free-credit account's servers: "daily" lifts at the next UTC day,
   * "total" with a first top-up. Null/absent: not capped.
   */
  promoCap?: "daily" | "total" | null;
  now?: Date;
}

export interface WalletNudge {
  level: NudgeLevel;
  reason: NudgeReason;
  headline: string;
  body: string;
  cta: { label: string; href: string };
  /** A dismissed nudge stays hidden for DISMISS_DAYS on that device. */
  dismissible: boolean;
  totalMicros: number;
  /** Promo expiry while some promo credit is left, else null. */
  promoExpiresAt: Date | null;
  /** Whole days until the promo credit expires (only while some is left). */
  promoDaysLeft: number | null;
  /** The account carries a legacy subscription awaiting conversion to credit. */
  legacySubscription: boolean;
}

/** Below this total balance the account is "low" (€2). */
export const LOW_BALANCE_MICROS = 2_000_000;
/** The promo-expiry reminder starts this many days before the expiry. */
export const PROMO_ALERT_DAYS = 7;
/** Free (never funded) accounts: runtimes are deleted this many days after the balance hit zero. */
export const RUNTIME_DELETION_AFTER_DAYS = 14;
export const DISMISS_DAYS = 7;
export const BILLING_HREF = "/dashboard/billing";

const DAY_MS = 86_400_000;

/** Subscription states that still bill a legacy Pro/Team plan. */
const LIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due", "unpaid"]);

export function nextUtcMidnight(now: Date): Date {
  return new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS + DAY_MS);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---- Money formatting -------------------------------------------------------

export type CreditLocale = "en" | "fr";

/**
 * "€12.34" (en) or "12,34 €" (fr). `precise` (the default) is the price-list
 * formatter (lib/wallet/pricing.ts formatEur): sub-cent amounts keep enough
 * decimals to stay non-zero ("€0.00003"). A balance passes `precise: false`
 * to always get two decimals.
 */
export function formatCredit(
  micros: number,
  opts: { locale?: CreditLocale; precise?: boolean } = {}
): string {
  const { locale = "en", precise = true } = opts;
  const value = Number.isFinite(micros) ? Math.trunc(micros) : 0;
  if (precise) return formatEur(value === 0 ? 0 : value, locale);
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value === 0 ? 0 : value / MICROS_PER_EUR);
}

/** A ledger amount with its sign: "+€10.00", "−€0.00003". */
export function formatSignedCredit(micros: number, locale: CreditLocale = "en"): string {
  const abs = formatCredit(Math.abs(micros), { locale });
  if (micros > 0) return `+${abs}`;
  if (micros < 0) return `−${abs}`;
  return abs;
}

// ---- Ledger descriptions ----------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  signup_credit: "Free sign-up credit",
  topup: "Top-up",
  auto_recharge: "Auto-recharge",
  admin_grant: "Credit from TwinMCP",
  subscription_conversion: "Subscription converted to credit",
  usage_tool_call: "Tool calls",
  usage_compute: "Compute time",
  clawback: "Payment reversed",
  promo_expiry: "Free credit expired",
  adjustment: "Adjustment",
};

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * One human line per ledger row, from its kind and the `units` the writer
 * recorded (calls for tool calls; cpu seconds or a server name for compute).
 * Unknown kinds fall back to "Adjustment"; a note is appended when present.
 */
export function describeLedgerEntry(entry: {
  kind: string;
  units?: Record<string, unknown> | null;
  note?: string | null;
}): string {
  const base = KIND_LABEL[entry.kind] ?? "Adjustment";
  const units = entry.units ?? {};
  const parts: string[] = [base];
  if (entry.kind === "usage_tool_call") {
    const calls = num(units.calls);
    if (calls !== null)
      parts.push(`${calls.toLocaleString("en-US")} call${calls === 1 ? "" : "s"}`);
  } else if (entry.kind === "usage_compute") {
    const server = typeof units.serverName === "string" ? units.serverName : null;
    const cpuSeconds =
      num(units.cpuSeconds) ??
      (num(units.cpuNs) !== null ? (num(units.cpuNs) as number) / 1e9 : null);
    if (server) parts.push(server);
    if (cpuSeconds !== null) parts.push(`${formatCpuTime(cpuSeconds)} CPU`);
  }
  if (entry.note && entry.kind !== "usage_tool_call") parts.push(entry.note);
  return parts.join(" · ");
}

/** "42 s", "3 min 20 s", "1 h 05 min". */
export function formatCpuTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest ? `${m} min ${rest} s` : `${m} min`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/** Ledger kinds that are usage (debits) rather than money in or out. */
export function isUsageKind(kind: string): boolean {
  return kind === "usage_tool_call" || kind === "usage_compute";
}

// ---- Credits page helpers ----------------------------------------------------

const HOUR_MS = 3_600_000;

/** "in 12 days", "in 5 hours", "within the hour", "expired". */
export function expiryCountdown(expiresAt: Date, now: Date): string {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "expired";
  if (ms < HOUR_MS) return "within the hour";
  if (ms < DAY_MS) {
    const h = Math.floor(ms / HOUR_MS);
    return `in ${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.ceil(ms / DAY_MS);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

/**
 * A custom top-up typed on the Credits page: whole euros within [min, max]
 * (the server checks again, lib/wallet/topup.ts parseTopupAmount).
 */
export function checkTopupAmount(
  raw: string,
  min: number,
  max: number
): { ok: true; amountEur: number } | { ok: false; message: string } {
  const text = raw.trim().replace(",", ".");
  const n = Number(text);
  if (!text || !Number.isFinite(n)) return { ok: false, message: "Enter an amount in euros." };
  if (!Number.isInteger(n)) return { ok: false, message: "Use a whole number of euros." };
  if (n < min) return { ok: false, message: `The minimum top-up is ${formatEurAmount(min)}.` };
  if (n > max) return { ok: false, message: `The maximum top-up is ${formatEurAmount(max)}.` };
  return { ok: true, amountEur: n };
}

export interface DailyCost {
  /** "YYYY-MM-DD" (UTC). */
  day: string;
  toolCallsMicros: number;
  computeMicros: number;
}

/**
 * The last `days` UTC days ending today, oldest first, with the ledger's
 * per-day usage (positive micro-euros) and zeros for days without any.
 */
export function fillCostDays(rows: DailyCost[], now: Date, days: number): DailyCost[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const today = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  const out: DailyCost[] = [];
  for (let i = Math.max(1, days) - 1; i >= 0; i--) {
    const day = new Date(today - i * DAY_MS).toISOString().slice(0, 10);
    const r = byDay.get(day);
    out.push({
      day,
      toolCallsMicros: Math.max(0, Math.trunc(r?.toolCallsMicros ?? 0)),
      computeMicros: Math.max(0, Math.trunc(r?.computeMicros ?? 0)),
    });
  }
  return out;
}

// ---- CTAs -------------------------------------------------------------------

export function topUpCta(reason: NudgeReason = "none"): { label: string; href: string } {
  return {
    label: reason === "zero_balance" ? "Top up to continue" : "Add credit",
    href: BILLING_HREF,
  };
}

/** Whole days until `end` (0 when already past). */
export function daysUntil(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * The one decision. Pure: same inputs, same nudge.
 */
export function computeWalletNudge(s: WalletSignals): WalletNudge {
  const now = s.now ?? new Date();
  const paid = Math.trunc(s.paidMicros || 0);
  const promo = Math.max(0, Math.trunc(s.promoMicros || 0));
  const total = paid + promo;
  const expiry = promo > 0 ? toDate(s.promoExpiresAt) : null;
  const promoDaysLeft = expiry ? daysUntil(expiry, now) : null;
  const legacySubscription =
    (s.plan === "pro" || s.plan === "team") &&
    Boolean(s.hasSubscription) &&
    LIVE_SUBSCRIPTION.has(s.subscriptionStatus ?? "");
  const base = {
    totalMicros: total,
    promoExpiresAt: expiry,
    promoDaysLeft,
    legacySubscription,
  };
  const quiet: WalletNudge = {
    ...base,
    level: "none",
    reason: "none",
    headline: "",
    body: "",
    cta: topUpCta(),
    dismissible: true,
  };

  if (!s.walletAvailable) return quiet;

  // A legacy subscriber keeps their plan until the owner-run conversion
  // credits the unused part of the period: say so before anything else (their
  // wallet is usually still empty, which is not "used up").
  if (legacySubscription) {
    if (s.subscriptionStatus === "past_due" || s.subscriptionStatus === "unpaid") {
      return {
        ...base,
        level: "past_due",
        reason: "past_due",
        headline: "Your last subscription payment could not be charged",
        body: "TwinMCP is moving to prepaid credit. Add credit now to keep your tool calls running; your subscription will be converted and cancelled.",
        cta: topUpCta(),
        dismissible: false,
      };
    }
    return {
      ...base,
      level: "info",
      reason: "legacy_subscription",
      headline: "Your subscription will be converted to credit",
      body: "TwinMCP now bills pay-as-you-go from a prepaid balance. The unused part of your current period will be added to your balance and the subscription cancelled. You will get an email; there is nothing to do.",
      cta: { label: "See my credit", href: BILLING_HREF },
      dismissible: true,
    };
  }

  if (total <= 0) {
    return {
      ...base,
      level: "limit",
      reason: "zero_balance",
      headline: s.funded ? "Your credit is used up" : "Your free credit is used up",
      body: s.funded
        ? "Tool calls are refused and your servers are paused until you add credit. Your servers and their settings are kept."
        : `Tool calls are refused and your server is paused. Add credit (from ${minTopupLabel()}) to continue; runtimes of accounts without credit are deleted after ${RUNTIME_DELETION_AFTER_DAYS} days, configurations are kept.`,
      cta: topUpCta("zero_balance"),
      dismissible: false,
    };
  }

  // Credit left, but free-credit compute hit its cap: servers were paused.
  // Without this, the user sees a stopped server and a positive balance.
  if (s.promoCap && !s.funded) {
    return {
      ...base,
      level: "warning",
      reason: "promo_cap",
      headline:
        s.promoCap === "daily"
          ? "Your free credit reached today's compute limit"
          : "Your free credit reached its compute limit",
      body:
        s.promoCap === "daily"
          ? "Servers running on free credit are paused for the rest of the day (UTC). You can start them again tomorrow, or right away after a first top-up."
          : "Servers running on free credit stay paused. A first top-up lifts the limit; your remaining free credit is still spent first.",
      cta: topUpCta("promo_cap"),
      dismissible: false,
    };
  }

  if (total < LOW_BALANCE_MICROS) {
    const recharge = s.funded && s.autoRechargeEnabled;
    return {
      ...base,
      level: "warning",
      reason: "low_balance",
      headline: `${formatCredit(total, { precise: false })} of credit left`,
      body: recharge
        ? "Auto-recharge is on: your saved card is charged when the balance drops below your threshold."
        : "When it reaches zero, tool calls are refused until you add credit. Turn on auto-recharge to never run out.",
      cta: topUpCta("low_balance"),
      dismissible: true,
    };
  }

  if (promo > 0 && expiry && promoDaysLeft !== null && promoDaysLeft <= PROMO_ALERT_DAYS) {
    const when =
      promoDaysLeft === 0 ? "today" : `in ${promoDaysLeft} day${promoDaysLeft === 1 ? "" : "s"}`;
    return {
      ...base,
      level: "trial",
      reason: "promo_expiring",
      headline: `Your free credit expires ${when}`,
      body: `${formatCredit(promo, { precise: false })} of free credit is left until ${fmtDay(expiry)}.${s.funded ? "" : " Add credit to keep your server running after that."}`,
      cta: topUpCta("promo_expiring"),
      dismissible: true,
    };
  }

  if (!s.funded) {
    const pro = PLAN_CAPABILITIES.pro;
    const free = PLAN_CAPABILITIES.free;
    const unlock = `A first top-up (from ${minTopupLabel()}) unlocks up to ${pro.servers} servers on every box size and publishing your own MCPs.`;
    if (s.serverCount >= free.servers) {
      return {
        ...base,
        level: "offer",
        reason: "servers_limit",
        headline: "Need more than one server?",
        body: `Free credit runs ${free.servers} small server. ${unlock}`,
        cta: topUpCta("servers_limit"),
        dismissible: true,
      };
    }
    if (s.keyCount !== undefined && s.keyCount >= free.apiKeys) {
      return {
        ...base,
        level: "offer",
        reason: "keys_limit",
        headline: "Out of API keys?",
        body: `Free credit includes ${free.apiKeys} API keys; a funded account gets ${pro.apiKeys}. ${unlock}`,
        cta: topUpCta("keys_limit"),
        dismissible: true,
      };
    }
    return {
      ...base,
      level: "offer",
      reason: "promo_only",
      headline: `You are on free credit: ${formatCredit(total, { precise: false })} left`,
      body: unlock,
      cta: topUpCta("promo_only"),
      dismissible: true,
    };
  }

  return quiet;
}

/** Levels that should interrupt the user (never dismissible, shown everywhere). */
export function isUrgent(level: NudgeLevel): boolean {
  return level === "limit" || level === "past_due";
}
