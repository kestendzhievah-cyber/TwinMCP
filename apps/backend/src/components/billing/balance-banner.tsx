import { BalanceBannerStrip } from "./balance-banner-strip";
import { withRuntimeDeletionPolicy, type SerializedWalletNudge } from "./banner-copy";

export { BANNER_LEVELS, type SerializedWalletNudge } from "./banner-copy";

/**
 * Server wrapper of the dashboard balance strip (./balance-banner-strip is the
 * client part). It applies the one server-only fact the nudge does not carry:
 * whether free-credit runtimes are really deleted after 14 days at zero
 * (WALLET_ENFORCE_ENABLED === "true"). Without it, the strip says the server
 * stays paused until a top-up instead of threatening a deletion that never
 * happens.
 */
export function BalanceBanner({ nudge }: { nudge: SerializedWalletNudge }) {
  const deletionEnabled = process.env.WALLET_ENFORCE_ENABLED === "true";
  return <BalanceBannerStrip nudge={withRuntimeDeletionPolicy(nudge, deletionEnabled)} />;
}
