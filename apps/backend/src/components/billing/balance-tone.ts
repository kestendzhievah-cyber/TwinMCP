import type { NudgeLevel } from "@/lib/billing/upgrade-state";

// How a balance surface looks (the sidebar pill card, the mobile chip, the
// overview credit card, the dashboard strip), from the one wallet decision
// (lib/billing/upgrade-state.ts computeWalletNudge). Pure presentation: no
// thresholds here, only a mapping from the nudge level to a tone.

export type BalanceTone = "promo" | "neutral" | "warning" | "danger";

/**
 * - danger:  credit used up, or a legacy subscription whose payment failed
 * - warning: low balance, or the free-credit compute cap paused the servers
 * - promo:   running on live free credit, no paid top-up yet
 * - neutral: everything else (a funded account)
 */
export function balanceTone(b: {
  level: NudgeLevel;
  funded: boolean;
  promoMicros: number;
}): BalanceTone {
  if (b.level === "limit" || b.level === "past_due") return "danger";
  if (b.level === "warning") return "warning";
  if (!b.funded && b.promoMicros > 0) return "promo";
  return "neutral";
}

/** Surface classes per tone: the 10 % tint recipe, or the soft-pink offer surface. */
export const TONE_SURFACE: Record<BalanceTone, string> = {
  promo: "border-offer-border bg-offer",
  neutral: "border-border bg-secondary",
  warning: "border-warning/30 bg-warning/10",
  danger: "border-destructive/30 bg-destructive/10",
};

/** The balance figure's colour per tone (rose for credit, status colour otherwise). */
export const TONE_FIGURE: Record<BalanceTone, string> = {
  promo: "text-primary",
  neutral: "text-primary",
  warning: "text-warning",
  danger: "text-destructive",
};

/** Compact chip (mobile top bar) per tone. */
export const TONE_CHIP: Record<BalanceTone, string> = {
  promo: "bg-offer text-offer-foreground",
  neutral: "bg-secondary text-foreground",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

/** Share of the sign-up credit still left, clamped to [0, 1] (progress bars). */
export function promoShare(promoMicros: number, signupMicros: number): number {
  if (!(signupMicros > 0) || !(promoMicros > 0)) return 0;
  return Math.min(1, promoMicros / signupMicros);
}

/** "23 days left", "1 day left", "expires today" ("" when unknown). */
export function daysLeftLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return "";
  if (days <= 0) return "expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
