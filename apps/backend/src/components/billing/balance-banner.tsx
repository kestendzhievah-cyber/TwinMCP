"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/funnel";
import {
  BILLING_HREF,
  DISMISS_DAYS,
  isUrgent,
  type NudgeLevel,
  type WalletNudge,
} from "@/lib/billing/upgrade-state";
import { cn } from "@/lib/utils";

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

const DISMISS_KEY = "tmcp_wallet_nudge_dismissed_until:";
const DAY_MS = 86_400_000;

// One strip per level, in the tint recipe (DESIGN.md §5 callouts:
// border-S/40 bg-S/10 text-S, with the memo rule on the left).
const STRIP: Record<NudgeLevel, { tint: string; eyebrow: string }> = {
  none: { tint: "", eyebrow: "" },
  offer: { tint: "border-brand/40 border-l-brand bg-brand/10 text-brand", eyebrow: "Credit" },
  info: { tint: "border-info/40 border-l-info bg-info/10 text-info", eyebrow: "Billing" },
  trial: { tint: "border-info/40 border-l-info bg-info/10 text-info", eyebrow: "Free credit" },
  warning: {
    tint: "border-warning/40 border-l-warning bg-warning/10 text-warning",
    eyebrow: "Low balance",
  },
  limit: {
    tint: "border-destructive/40 border-l-destructive bg-destructive/10 text-destructive",
    eyebrow: "Credit used up",
  },
  past_due: {
    tint: "border-destructive/40 border-l-destructive bg-destructive/10 text-destructive",
    eyebrow: "Payment",
  },
};

function isDismissed(key: string): boolean {
  try {
    const until = Number(localStorage.getItem(key));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissal(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now() + DISMISS_DAYS * DAY_MS));
  } catch {
    // Private mode / blocked storage: the strip simply comes back next load.
  }
}

/**
 * The full-width strip under the dashboard header (the layout renders it for
 * BANNER_LEVELS): credit used up, low balance, free credit expiring, legacy
 * subscription conversion. Dismissal is per device and per reason, for
 * DISMISS_DAYS; urgent levels (credit used up, failed payment) are never
 * dismissible and render on the server pass, everything else waits for the
 * client so a dismissed strip never flashes. On the Credits page itself only
 * the urgent strip shows (the balance card already says the rest).
 */
export function BalanceBanner({ nudge }: { nudge: SerializedWalletNudge }) {
  const pathname = usePathname();
  const urgent = isUrgent(nudge.level);
  const key = DISMISS_KEY + nudge.reason;
  const [visible, setVisible] = useState(urgent);
  const viewed = useRef(false);

  useEffect(() => {
    if (urgent) return;
    setVisible(!isDismissed(key));
  }, [key, urgent]);

  const shown = BANNER_LEVELS.has(nudge.level) && visible && (urgent || pathname !== BILLING_HREF);
  const { level, reason } = nudge;

  useEffect(() => {
    if (!shown || viewed.current) return;
    viewed.current = true;
    track({ name: "upgrade_nudge_viewed", properties: { source: "banner", level, reason } });
  }, [shown, level, reason]);

  if (!shown) return null;
  const strip = STRIP[level];

  function dismiss() {
    rememberDismissal(key);
    setVisible(false);
  }

  return (
    <aside
      aria-label="Credit notice"
      className={cn(
        "mb-6 flex flex-col gap-3 border border-l-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:mb-8",
        strip.tint
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="smallcaps tracking-sc text-xs">{strip.eyebrow}</p>
        <p className="font-medium">{nudge.headline}</p>
        <p className="text-sm italic text-muted-foreground">{nudge.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {pathname !== BILLING_HREF && (
          <Button asChild size="sm">
            <Link
              href={nudge.cta.href as Route}
              onClick={() =>
                track({
                  name: "upgrade_cta_clicked",
                  properties: { source: "banner", level, reason },
                })
              }
            >
              {nudge.cta.label}
            </Link>
          </Button>
        )}
        {nudge.dismissible && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Dismiss for ${DISMISS_DAYS} days`}
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}
