import type { NudgeLevel, WalletNudge } from "@/lib/billing/upgrade-state";
import { minTopupLabel } from "@/lib/wallet/pricing";

// Pure helpers shared by the dashboard balance strip (server wrapper and
// client strip). No I/O, no React: safe on both sides and unit-tested.

/** WalletNudge as it crosses the server → client boundary (Dates as ISO strings). */
export type SerializedWalletNudge = Omit<WalletNudge, "promoExpiresAt"> & {
  promoExpiresAt: string | null;
};

/** The levels the dashboard strip speaks for: balance, expiry, legacy subscription. */
export const BANNER_LEVELS: ReadonlySet<NudgeLevel> = new Set<NudgeLevel>([
  "limit",
  "warning",
  "trial",
  "info",
  "past_due",
]);

/** The zero-balance body for an unfunded account while no runtime is ever deleted. */
export function pausedUntilTopUpBody(): string {
  return `Tool calls are refused and your server is paused. It stays paused until you add credit (from ${minTopupLabel()}); its MCPs and settings are kept.`;
}

/**
 * The runtime-deletion sentence ("runtimes … are deleted after 14 days") is
 * true only while the deletion countdown runs (WALLET_ENFORCE_ENABLED ===
 * "true", lib/wallet/compute-meter.ts runWalletEnforce). Otherwise the
 * zero-balance strip says the server stays paused until a top-up. Pure: the
 * caller passes the switch.
 */
export function withRuntimeDeletionPolicy<T extends Pick<WalletNudge, "reason" | "body">>(
  nudge: T,
  deletionEnabled: boolean
): T {
  if (deletionEnabled || nudge.reason !== "zero_balance") return nudge;
  if (!/\bdeleted after\b/i.test(nudge.body)) return nudge;
  return { ...nudge, body: pausedUntilTopUpBody() };
}
