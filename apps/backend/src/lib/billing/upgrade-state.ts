import type { Plan } from "@/db/schema";
import { PLAN_CAPABILITIES, PRO_TRIAL_DAYS } from "@/lib/plan-features";

/**
 * Upgrade nudges — one pure decision for every surface.
 *
 * The dashboard layout, the overview cards, the usage page, the lifecycle
 * emails and the admin tooling all need to answer the same question: "what
 * should we tell this account about Pro right now, and how loudly?". Keeping
 * the decision here (no DB, no env, no React) means one set of copy, one set
 * of thresholds, and a unit test per branch.
 *
 * Levels, from quiet to loud:
 *  - none      paid account in good standing, nothing to say
 *  - offer     Free account: the standing offer (first month of Pro free)
 *  - warning   Free account at ≥ WARN_PCT of today's tool-call quota
 *  - limit     Free account at 100 %: tool calls are being rejected
 *  - trial     Pro trial ending within TRIAL_ALERT_DAYS
 *  - past_due  payment failed — access is at risk
 *
 * Client-safe: type imports + plan-features only (no server modules).
 */

export type NudgeLevel = "none" | "offer" | "warning" | "limit" | "trial" | "past_due";

export type NudgeReason =
  | "none"
  | "offer"
  | "servers_limit"
  | "keys_limit"
  | "quota_warning"
  | "quota_limit"
  | "trial_ending"
  | "past_due";

/** Where a nudge was shown or clicked — the analytics `source` property. */
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

export interface UpgradeSignals {
  plan: Plan;
  /** Tool calls (billed `tools/call` messages, lib/mcp/billable.ts) counted since UTC midnight (usage_metrics). */
  usedToday: number;
  /** Daily tool-call quota of the account's plan (getDailyLimit(plan)). */
  dailyLimit: number;
  /** Daily tool-call quota of Pro, for the copy (getDailyLimit("pro")). */
  proDailyLimit: number;
  /** Servers not destroyed. */
  serverCount: number;
  /** Active API keys (optional: not every surface loads them). */
  keyCount?: number;
  /** Stripe subscription status mirrored on users.subscription_status. */
  subscriptionStatus?: string | null;
  /** users.current_period_end — the trial end while trialing. */
  currentPeriodEnd?: Date | string | null;
  /** users.cancel_at_period_end — a trial already cancelled ends without a charge. */
  cancelAtPeriodEnd?: boolean;
  /** users.stripe_customer_id present → the first-month trial is used up. */
  hasStripeCustomer: boolean;
  now?: Date;
}

export interface UpgradeNudge {
  level: NudgeLevel;
  reason: NudgeReason;
  headline: string;
  body: string;
  cta: { label: string; href: string };
  /** A dismissed nudge stays hidden for DISMISS_DAYS on that device. */
  dismissible: boolean;
  trialEligible: boolean;
  trialDays: number;
  /** 0–100, capped. */
  quotaPct: number;
  /** Next UTC midnight: when the daily quota resets. */
  resetsAt: Date;
  /** Trial end (only while trialing). */
  trialEndsAt: Date | null;
  /** Whole days until the trial ends (only while trialing). */
  trialDaysLeft: number | null;
}

export const WARN_PCT = 80;
export const TRIAL_ALERT_DAYS = 7;
export const DISMISS_DAYS = 7;
export const BILLING_HREF = "/dashboard/billing";

const DAY_MS = 86_400_000;

export function nextUtcMidnight(now: Date): Date {
  return new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS + DAY_MS);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export function trialCta(trialEligible: boolean): { label: string; href: string } {
  return {
    label: trialEligible ? "Start my free month of Pro" : "Upgrade to Pro",
    href: BILLING_HREF,
  };
}

/**
 * The one decision. Pure: same inputs, same nudge.
 */
export function computeUpgradeNudge(s: UpgradeSignals): UpgradeNudge {
  const now = s.now ?? new Date();
  const resetsAt = nextUtcMidnight(now);
  const pro = PLAN_CAPABILITIES.pro;
  const trialEligible = s.plan === "free" && !s.hasStripeCustomer;
  const trialDays = trialEligible ? PRO_TRIAL_DAYS : 0;
  const quotaPct =
    s.dailyLimit > 0 ? Math.min(100, Math.round((s.usedToday / s.dailyLimit) * 100)) : 0;
  const base = {
    trialEligible,
    trialDays,
    quotaPct,
    resetsAt,
    trialEndsAt: null as Date | null,
    trialDaysLeft: null as number | null,
  };

  // ---- Paid accounts -------------------------------------------------------
  if (s.plan !== "free") {
    const status = s.subscriptionStatus ?? null;
    if (status === "past_due" || status === "unpaid") {
      return {
        ...base,
        level: "past_due",
        reason: "past_due",
        headline: "Your last payment could not be charged",
        body: "Update your payment method to keep your Pro limits. Your servers stay up meanwhile.",
        cta: { label: "Update payment method", href: BILLING_HREF },
        dismissible: false,
      };
    }
    const end = toDate(s.currentPeriodEnd);
    if (status === "trialing" && end) {
      const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
      const trialBase = { ...base, trialEndsAt: end, trialDaysLeft: daysLeft };
      // A cancelled trial simply runs out: no charge is coming, so there is
      // nothing to warn about (the billing memo says it cancels on that date).
      if (daysLeft <= TRIAL_ALERT_DAYS && !s.cancelAtPeriodEnd) {
        return {
          ...trialBase,
          level: "trial",
          reason: "trial_ending",
          headline:
            daysLeft === 0
              ? "Your free month of Pro ends today"
              : `Your free month of Pro ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          body: `On ${fmtDay(end)} your subscription continues at the price you chose. Nothing to do to keep Pro; cancel from Billing if you'd rather stop.`,
          cta: { label: "Review my subscription", href: BILLING_HREF },
          dismissible: true,
        };
      }
      return {
        ...trialBase,
        level: "none",
        reason: "none",
        headline: "",
        body: "",
        cta: trialCta(false),
        dismissible: true,
      };
    }
    return {
      ...base,
      level: "none",
      reason: "none",
      headline: "",
      body: "",
      cta: trialCta(false),
      dismissible: true,
    };
  }

  // ---- Free accounts -------------------------------------------------------
  const cta = trialCta(trialEligible);
  const proLine = `Pro raises it to ${fmtInt(s.proDailyLimit)} a day${trialEligible ? ", and your first month is free" : ""}.`;

  if (s.dailyLimit > 0 && s.usedToday >= s.dailyLimit) {
    return {
      ...base,
      level: "limit",
      reason: "quota_limit",
      headline: `Daily limit reached: ${fmtInt(s.usedToday)} of ${fmtInt(s.dailyLimit)} tool calls`,
      body: `Tool calls from your IDE are rejected until the quota resets at midnight UTC. ${proLine}`,
      cta,
      dismissible: false,
    };
  }

  if (quotaPct >= WARN_PCT) {
    return {
      ...base,
      level: "warning",
      reason: "quota_warning",
      headline: `${fmtInt(s.usedToday)} of ${fmtInt(s.dailyLimit)} tool calls used today`,
      body: `At ${fmtInt(s.dailyLimit)} your IDE stops getting answers until midnight UTC. ${proLine}`,
      cta,
      dismissible: true,
    };
  }

  if (s.serverCount >= PLAN_CAPABILITIES.free.servers) {
    return {
      ...base,
      level: "offer",
      reason: "servers_limit",
      headline: trialEligible ? "Your first month of Pro is free" : "Need more than one server?",
      body: `Free includes ${PLAN_CAPABILITIES.free.servers} small server. Pro runs up to ${pro.servers} servers on small, medium or large boxes, with ${fmtInt(s.proDailyLimit)} tool calls a day.`,
      cta,
      dismissible: true,
    };
  }

  if (s.keyCount !== undefined && s.keyCount >= PLAN_CAPABILITIES.free.apiKeys) {
    return {
      ...base,
      level: "offer",
      reason: "keys_limit",
      headline: trialEligible ? "Your first month of Pro is free" : "Out of API keys?",
      body: `Free includes ${PLAN_CAPABILITIES.free.apiKeys} API keys. Pro gives you ${pro.apiKeys}, plus audit logs for ${pro.auditRetentionDays} days.`,
      cta,
      dismissible: true,
    };
  }

  return {
    ...base,
    level: "offer",
    reason: "offer",
    headline: trialEligible ? "Your first month of Pro is free" : "More room to build with Pro",
    body: `${pro.servers} servers, every box size, ${fmtInt(s.proDailyLimit)} tool calls a day, ${pro.apiKeys} API keys and audit logs${trialEligible ? `. Card required, nothing charged for ${trialDays} days, cancel anytime` : ""}.`,
    cta,
    dismissible: true,
  };
}

/** Levels that should interrupt the user (never dismissible, shown everywhere). */
export function isUrgent(level: NudgeLevel): boolean {
  return level === "limit" || level === "past_due";
}
