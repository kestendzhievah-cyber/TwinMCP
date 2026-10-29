import Link from "next/link";
import type { Route } from "next";
import { Lock, ArrowUpRight } from "lucide-react";
import type { Plan } from "@/db/schema/core";
import { isSellablePlan, PLAN_LABELS } from "@/lib/plan-features";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpgradeCardProps {
  title: string;
  description?: React.ReactNode;
  /**
   * Plan the user must reach to unlock the feature. Only a sellable plan (Pro)
   * gets an upgrade CTA; a feature only the grandfathered Team plan had is shown
   * as unavailable, never as something to buy.
   */
  requiredPlan: Plan;
  ctaLabel?: string;
  /** Where the CTA points. Defaults to the billing page. */
  href?: string;
  className?: string;
}

/**
 * Presentational "this feature is locked — upgrade" card. Server-safe: no
 * client hooks. Pages decide when to render it (see FeatureGate for the common
 * allow/deny wrapper).
 *
 * Typeset as an empty slot on the card (DESIGN.md §5): dashed ink hairline, a
 * bare lock, the required plan as a hairline seal, small-caps title, italic
 * body, one ink button. The seal is outline, not gilt: a Free account already
 * sees the one gilt seal of the view on the upgrade strip (UpgradeBanner), and
 * DESIGN.md allows at most one per view. When the required plan is no longer sold (Team), the
 * seal and button are dropped and the slot reads as unavailable instead.
 */
export function UpgradeCard({
  title,
  description,
  requiredPlan,
  ctaLabel,
  href = "/dashboard/billing",
  className,
}: UpgradeCardProps) {
  const purchasable = isSellablePlan(requiredPlan);
  return (
    <Card
      className={cn("border-dashed border-foreground/40 bg-transparent shadow-none", className)}
    >
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Lock aria-hidden className="h-6 w-6 text-muted-foreground" />
        {purchasable && <Badge variant="outline">{PLAN_LABELS[requiredPlan]}</Badge>}
        <div className="max-w-md space-y-2">
          <h2 className="smallcaps tracking-sc text-base font-medium">{title}</h2>
          {description && <p className="text-sm italic text-muted-foreground">{description}</p>}
          <p className="text-xs italic text-muted-foreground">
            {purchasable
              ? `Included in the ${PLAN_LABELS[requiredPlan]} plan.`
              : "Not available on current plans."}
          </p>
        </div>
        {purchasable && (
          <Button asChild className="mt-1">
            <Link href={href as Route}>
              {ctaLabel ?? `Upgrade to ${PLAN_LABELS[requiredPlan]}`}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
