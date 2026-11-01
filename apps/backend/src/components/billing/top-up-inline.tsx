"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { track } from "@/lib/analytics/funnel";
import { BILLING_HREF, type NudgeLevel, type NudgeSource } from "@/lib/billing/upgrade-state";
import { maxMcpsForBoxSize } from "@/lib/plan-features";
import { formatEurAmount } from "@/lib/wallet/pricing";
import { cn } from "@/lib/utils";

/**
 * Small, contextual "add credit" prompts: a one-line tinted callout
 * (TopUpInline, e.g. "Top up to continue", optionally with amount chips), a
 * bare text link (TopUpLink) and
 * the marketplace "box is full" toast. Every surface fires the same two funnel
 * events — `upgrade_nudge_viewed` once on mount and `upgrade_cta_clicked` on
 * the CTA (the event names predate the wallet) — so the viewed → clicked ratio
 * can be compared per `source`.
 *
 * Copy is the caller's: figures must come from lib/plan-features.ts or the
 * wallet price list (lib/wallet/pricing.ts), never typed inline.
 */

const LINK = "font-medium text-brand underline-offset-4 hover:underline";

// The tint recipe per level (docs/DESIGN.md callouts): a rounded strip with a
// /30 border and a /10 fill, text in navy. The standing free-credit offer
// uses the soft-pink offer surface; urgent levels carry their status colour.
const TINT: Record<NudgeLevel, string> = {
  none: "border-brand/30 bg-brand/10",
  info: "border-info/30 bg-info/10",
  offer: "border-offer-border bg-offer",
  trial: "border-info/30 bg-info/10",
  warning: "border-warning/30 bg-warning/10",
  limit: "border-destructive/30 bg-destructive/10",
  past_due: "border-destructive/30 bg-destructive/10",
};

// The CTA's colour on each tint (all AA on their /10 fill or the offer pink).
const CTA_TEXT: Record<NudgeLevel, string> = {
  none: "text-brand",
  info: "text-info",
  offer: "text-offer-foreground",
  trial: "text-info",
  warning: "text-warning",
  limit: "text-destructive",
  past_due: "text-destructive",
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
  /**
   * Quick amounts (whole euros, from the price list): one chip per amount,
   * linking to the Credits page with that amount pre-selected (?amount=).
   */
  presetsEur?: readonly number[];
  className?: string;
}

/** A one-line tinted callout with the top-up link at the end (and optional amount chips). */
export function TopUpInline({
  source,
  level = "offer",
  reason = "promo_only",
  label,
  href = BILLING_HREF,
  description,
  presetsEur,
  className,
}: TopUpInlineProps) {
  useNudgeViewed({ source, level, reason });
  const text = label ?? (level === "limit" ? "Top up to continue" : "Add credit");
  const id: NudgeIdentity = { source, level, reason };
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5 text-sm text-foreground",
        TINT[level],
        className
      )}
    >
      {description && <span className="min-w-0">{description}</span>}
      {presetsEur && presetsEur.length > 0 && (
        <span className="flex flex-wrap items-center gap-2">
          {presetsEur.map((amount) => (
            <Link
              key={amount}
              href={`${href}?amount=${amount}` as Route}
              onClick={() => trackTopUpClick(id)}
              className="inline-flex h-9 items-center rounded-full border border-input bg-card px-3 text-sm font-semibold tabular-nums text-foreground transition-colors hover:border-brand hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {formatEurAmount(amount)}
            </Link>
          ))}
        </span>
      )}
      <Link
        href={href as Route}
        onClick={() => trackTopUpClick(id)}
        className={cn(
          "font-semibold underline underline-offset-4 hover:no-underline",
          CTA_TEXT[level]
        )}
      >
        {text}
      </Link>
    </div>
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
