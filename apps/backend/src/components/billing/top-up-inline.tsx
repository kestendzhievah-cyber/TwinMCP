"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { track } from "@/lib/analytics/funnel";
import { BILLING_HREF, type NudgeLevel, type NudgeSource } from "@/lib/billing/upgrade-state";
import { maxMcpsForBoxSize } from "@/lib/plan-features";
import { cn } from "@/lib/utils";

/**
 * Small, contextual "add credit" prompts: a one-line tinted callout
 * (TopUpInline, e.g. "Top up to continue"), a bare text link (TopUpLink) and
 * the marketplace "box is full" toast. Every surface fires the same two funnel
 * events — `upgrade_nudge_viewed` once on mount and `upgrade_cta_clicked` on
 * the CTA (the event names predate the wallet) — so the viewed → clicked ratio
 * can be compared per `source`.
 *
 * Copy is the caller's: figures must come from lib/plan-features.ts or the
 * wallet price list (lib/wallet/pricing.ts), never typed inline.
 */

const LINK = "text-brand underline underline-offset-4 decoration-brand/40 hover:decoration-brand";

// The tint recipe per level (DESIGN.md §5 callouts): hairline + 10 % tint +
// text, with the memo rule on the left. The standing offer is navy (brand) —
// gilt is reserved for the one seal of a view.
const TINT: Record<NudgeLevel, string> = {
  none: "border-brand/40 border-l-brand bg-brand/10 text-brand",
  info: "border-info/40 border-l-info bg-info/10 text-info",
  offer: "border-brand/40 border-l-brand bg-brand/10 text-brand",
  trial: "border-info/40 border-l-info bg-info/10 text-info",
  warning: "border-warning/40 border-l-warning bg-warning/10 text-warning",
  limit: "border-destructive/40 border-l-destructive bg-destructive/10 text-destructive",
  past_due: "border-destructive/40 border-l-destructive bg-destructive/10 text-destructive",
};

export interface NudgeIdentity {
  source: NudgeSource;
  level: NudgeLevel;
  /** Why the prompt is showing (NudgeReason or a surface-specific string). */
  reason: string;
}

/** Fires `upgrade_nudge_viewed` once per mount. */
export function useNudgeViewed({ source, level, reason }: NudgeIdentity): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track({ name: "upgrade_nudge_viewed", properties: { source, level, reason } });
  }, [source, level, reason]);
}

export function trackTopUpClick({ source, level, reason }: NudgeIdentity): void {
  track({ name: "upgrade_cta_clicked", properties: { source, level, reason } });
}

interface TopUpInlineProps extends Partial<Omit<NudgeIdentity, "source">> {
  source: NudgeSource;
  /** CTA text. Defaults to "Top up to continue" at zero, "Add credit" otherwise. */
  label?: string;
  href?: string;
  description?: React.ReactNode;
  className?: string;
}

/** A one-line tinted callout with the top-up link at the end. */
export function TopUpInline({
  source,
  level = "offer",
  reason = "promo_only",
  label,
  href = BILLING_HREF,
  description,
  className,
}: TopUpInlineProps) {
  useNudgeViewed({ source, level, reason });
  const text = label ?? (level === "limit" ? "Top up to continue" : "Add credit");
  return (
    <p
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-l-2 px-3 py-2 text-sm",
        TINT[level],
        className
      )}
    >
      {description && <span className="min-w-0">{description}</span>}
      <Link
        href={href as Route}
        onClick={() => trackTopUpClick({ source, level, reason })}
        className={cn("font-medium", LINK)}
      >
        {text}
      </Link>
    </p>
  );
}

interface TopUpLinkProps extends Partial<Omit<NudgeIdentity, "source">> {
  source: NudgeSource;
  label: string;
  href?: string;
  className?: string;
}

/** The bare text-link variant, for a sentence that already explains itself. */
export function TopUpLink({
  source,
  level = "offer",
  reason = "promo_only",
  label,
  href = BILLING_HREF,
  className,
}: TopUpLinkProps) {
  useNudgeViewed({ source, level, reason });
  return (
    <Link
      href={href as Route}
      onClick={() => trackTopUpClick({ source, level, reason })}
      className={cn(LINK, className)}
    >
      {label}
    </Link>
  );
}

/**
 * True when a 403 from POST /api/v2/servers/:id/mcps says a SMALL box is at
 * its MCP cap (the only size an account without paid credit can run). Medium
 * and large boxes keep the server's own message, which already suggests a
 * larger box.
 */
export function isSmallBoxFull(message: string): boolean {
  return /\bsmall box can run\b/i.test(message);
}

/**
 * Marketplace: the small box is full. The toast carries one action that
 * points at Billing (larger boxes come with a first top-up), tracked like any CTA.
 */
export function toastBoxFull(source: NudgeSource = "marketplace"): void {
  const id: NudgeIdentity = { source, level: "offer", reason: "box_capacity" };
  track({ name: "upgrade_nudge_viewed", properties: id });
  toast.error(
    `This small box is full (${maxMcpsForBoxSize("small")} MCPs). With paid credit, larger boxes run up to ${maxMcpsForBoxSize("large")}.`,
    {
      action: {
        label: "Add credit",
        onClick: () => {
          trackTopUpClick(id);
          window.location.href = BILLING_HREF;
        },
      },
    }
  );
}
