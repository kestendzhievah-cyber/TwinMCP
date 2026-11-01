"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { AlertTriangle, Info, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/funnel";
import { BILLING_HREF, DISMISS_DAYS, isUrgent, type NudgeLevel } from "@/lib/billing/upgrade-state";
import { BANNER_LEVELS, type SerializedWalletNudge } from "./banner-copy";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "tmcp_wallet_nudge_dismissed_until:";
const DAY_MS = 86_400_000;

// One strip per level: the 10 % tint recipe, with an icon so the state never
// relies on colour alone. The layout only renders BANNER_LEVELS (warning,
// limit, past_due); the other entries keep the record total.
const STRIP: Record<NudgeLevel, { tint: string; icon: LucideIcon; iconColor: string }> = {
  none: { tint: "", icon: Info, iconColor: "" },
  offer: { tint: "border-offer-border bg-offer", icon: Info, iconColor: "text-offer-foreground" },
  info: { tint: "border-info/30 bg-info/10", icon: Info, iconColor: "text-info" },
  trial: { tint: "border-info/30 bg-info/10", icon: Info, iconColor: "text-info" },
  warning: {
    tint: "border-warning/30 bg-warning/10",
    icon: AlertTriangle,
    iconColor: "text-warning",
  },
  limit: {
    tint: "border-destructive/30 bg-destructive/10",
    icon: AlertTriangle,
    iconColor: "text-destructive",
  },
  past_due: {
    tint: "border-destructive/30 bg-destructive/10",
    icon: AlertTriangle,
    iconColor: "text-destructive",
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
 * The full-width rounded strip at the top of the dashboard page (the layout
 * renders it for BANNER_LEVELS, through the server wrapper in
 * ./balance-banner): credit used up, low balance, a failed legacy payment.
 * Dismissal is per device and per reason, for DISMISS_DAYS; urgent levels
 * (credit used up, failed payment) are never dismissible and render on the
 * server pass, everything else waits for the client so a dismissed strip
 * never flashes. On the Credits page itself only the urgent strip shows (the
 * balance card already says the rest).
 */
export function BalanceBannerStrip({ nudge }: { nudge: SerializedWalletNudge }) {
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

  const Icon = strip.icon;
  return (
    <aside
      aria-label="Credit notice"
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:mb-8",
        strip.tint
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", strip.iconColor)} />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold text-foreground">{nudge.headline}</p>
          <p className="text-sm text-muted-foreground">{nudge.body}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 pl-8 sm:gap-2 sm:pl-0">
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
