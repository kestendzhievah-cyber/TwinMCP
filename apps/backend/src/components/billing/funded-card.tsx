import Link from "next/link";
import type { Route } from "next";
import { Lock, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
 * Typeset as an empty slot on the card (DESIGN.md §5): dashed ink hairline, a
 * bare lock, a hairline seal, small-caps title, italic body, one ink button.
 * The seal is outline, not gilt (one gilt seal per view at most).
 */
export function FundedCard({
  title,
  description,
  ctaLabel = "Add credit",
  href = "/dashboard/billing",
  unavailable = false,
  className,
}: FundedCardProps) {
  return (
    <Card
      className={cn("border-dashed border-foreground/40 bg-transparent shadow-none", className)}
    >
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Lock aria-hidden className="h-6 w-6 text-muted-foreground" />
        {!unavailable && <Badge variant="outline">Paid credit</Badge>}
        <div className="max-w-md space-y-2">
          <h2 className="smallcaps tracking-sc text-base font-medium">{title}</h2>
          {description && <p className="text-sm italic text-muted-foreground">{description}</p>}
          <p className="text-xs italic text-muted-foreground">
            {unavailable
              ? "Not available on current accounts."
              : `Unlocked by a first top-up (from ${minTopupLabel()}). No subscription: you pay for what you use.`}
          </p>
        </div>
        {!unavailable && (
          <Button asChild className="mt-1">
            <Link href={href as Route}>
              {ctaLabel}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
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
