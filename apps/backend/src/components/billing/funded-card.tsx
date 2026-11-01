import Link from "next/link";
import type { Route } from "next";
import { Lock, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { minTopupLabel } from "@/lib/wallet/pricing";

interface FundedCardProps {
  title: string;
  description?: React.ReactNode;
  ctaLabel?: string;
  /** Where the CTA points. Defaults to the Credits page. */
  href?: string;
  /** The feature is not offered at all any more (no top-up unlocks it). */
  unavailable?: boolean;
  className?: string;
}

/**
 * Presentational "this needs paid credit" card. Server-safe: no client hooks.
 * Pages decide when to render it (see FundedGate for the common allow/deny
 * wrapper). It is a UI convenience only — the server enforces access.
 *
 * An offer card (docs/DESIGN.md, Card recipes): the soft-pink surface, a lock
 * in a white circle, the "Unlocks with first top-up" pill and one primary
 * button. A feature that no top-up unlocks gets the neutral dashed slot.
 */
export function FundedCard({
  title,
  description,
  ctaLabel = "Top up",
  href = "/dashboard/billing",
  unavailable = false,
  className,
}: FundedCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border p-8 text-center sm:p-10",
        unavailable
          ? "border-2 border-dashed border-border bg-card"
          : "border-offer-border bg-offer",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full",
          unavailable ? "bg-secondary text-muted-foreground" : "bg-card text-offer-foreground"
        )}
      >
        <Lock className="h-5 w-5" />
      </span>
      {!unavailable && <Badge variant="offer">Unlocks with first top-up</Badge>}
      <div className="max-w-md space-y-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <p
          className={cn("text-xs", unavailable ? "text-muted-foreground" : "text-offer-foreground")}
        >
          {unavailable
            ? "Not available on current accounts."
            : `Unlocked by a first top-up (from ${minTopupLabel()}). No subscription: you pay for what you use.`}
        </p>
      </div>
      {!unavailable && (
        <Button asChild className="mt-1 w-full sm:w-auto">
          <Link href={href as Route}>
            {ctaLabel}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

interface FundedGateProps {
  /** The account has paid credit (wallet funded; users.plan 'pro'). */
  funded: boolean;
  title: string;
  description?: React.ReactNode;
  ctaLabel?: string;
  children: React.ReactNode;
}

/**
 * Renders `children` for a funded account, otherwise a FundedCard. A UI
 * convenience only — never the security boundary.
 */
export function FundedGate({ funded, title, description, ctaLabel, children }: FundedGateProps) {
  if (funded) return <>{children}</>;
  return <FundedCard title={title} description={description} ctaLabel={ctaLabel} />;
}
