"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/funnel";
import {
  BILLING_HREF,
  DISMISS_DAYS,
  isUrgent,
  type NudgeLevel,
  type UpgradeNudge,
} from "@/lib/billing/upgrade-state";
import { cn } from "@/lib/utils";

/** UpgradeNudge as it crosses the server → client boundary (Dates as ISO strings). */
export type SerializedNudge = Omit<UpgradeNudge, "resetsAt" | "trialEndsAt"> & {
  resetsAt: string;
  trialEndsAt: string | null;
};

const DISMISS_KEY = "tmcp_nudge_dismissed_until:";
const DAY_MS = 86_400_000;

// One strip per level, in the tint recipe (DESIGN.md §5 callouts:
// border-S/40 bg-S/10 text-S, with the memo rule on the left). The standing
// offer is set in brass and carries the one gilt seal of the view, the "Pro"
// badge; the body stays in muted ink so it reads as a memo, not an ad.
const STRIP: Record<Exclude<NudgeLevel, "none">, { tint: string; eyebrow: string }> = {
  offer: {
    tint: "border-gilt/40 border-l-gilt bg-gilt/10 text-gilt",
    eyebrow: "Free plan",
  },
  warning: {
    tint: "border-warning/40 border-l-warning bg-warning/10 text-warning",
    eyebrow: "Daily quota",
  },
  limit: {
    tint: "border-destructive/40 border-l-destructive bg-destructive/10 text-destructive",
    eyebrow: "Daily quota",
  },
  trial: { tint: "border-info/40 border-l-info bg-info/10 text-info", eyebrow: "Pro trial" },
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
 * The full-width strip under the dashboard header (rendered by the layout
 * when the nudge level is not "none"). Dismissal is per device and per
 * reason, for DISMISS_DAYS; urgent levels (quota hit, payment failed) are
 * never dismissible and render on the server pass, everything else waits for
 * the client so a dismissed strip never flashes.
 */
export function UpgradeBanner({ nudge }: { nudge: SerializedNudge }) {
  const pathname = usePathname();
  const urgent = isUrgent(nudge.level);
  const key = DISMISS_KEY + nudge.reason;
  const [visible, setVisible] = useState(urgent);
  const viewed = useRef(false);

  useEffect(() => {
    if (urgent) return;
    setVisible(!isDismissed(key));
  }, [key, urgent]);

  // The CTA points at Billing: on that page the pricing card and its memos do
  // the talking (and a second gilt seal would double the "Best value" one).
  const shown = nudge.level !== "none" && visible && (urgent || pathname !== BILLING_HREF);
  const { level, reason } = nudge;

  useEffect(() => {
    if (!shown || viewed.current) return;
    viewed.current = true;
    track({ name: "upgrade_nudge_viewed", properties: { source: "banner", level, reason } });
  }, [shown, level, reason]);

  if (!shown || level === "none") return null;
  const strip = STRIP[level];

  function dismiss() {
    rememberDismissal(key);
    setVisible(false);
  }

  return (
    <aside
      aria-label="Plan notice"
      className={cn(
        "mb-6 flex flex-col gap-3 border border-l-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:mb-8",
        strip.tint
      )}
    >
      <div className="min-w-0 space-y-1">
        {/* A div, not a p: <Badge> renders a block element and may not nest in a paragraph. */}
        <div className="smallcaps tracking-sc flex flex-wrap items-center gap-2 text-xs">
          {strip.eyebrow}
          {level === "offer" && <Badge variant="gilt">Pro</Badge>}
        </div>
        <p className="font-medium">{nudge.headline}</p>
        <p className="text-sm italic text-muted-foreground">{nudge.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
