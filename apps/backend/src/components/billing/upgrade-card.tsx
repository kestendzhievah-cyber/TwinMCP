import Link from "next/link";
import type { Route } from "next";
import { Lock, ArrowUpRight } from "lucide-react";
import type { Plan } from "@/db/schema/core";
import { PLAN_LABELS } from "@/lib/plan-features";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpgradeCardProps {
  title: string;
  description?: React.ReactNode;
  /** Plan the user must reach to unlock the feature. */
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
 * bare lock, the required plan as a brass seal (§4.8), small-caps title, italic
 * body, one ink button.
 */
export function UpgradeCard({
  title,
  description,
  requiredPlan,
  ctaLabel,
  href = "/dashboard/billing",
  className,
}: UpgradeCardProps) {
  return (
    <Card
      className={cn("border-dashed border-foreground/40 bg-transparent shadow-none", className)}
    >
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Lock aria-hidden className="h-6 w-6 text-muted-foreground" />
        <Badge variant="gilt">{PLAN_LABELS[requiredPlan]}</Badge>
        <div className="max-w-md space-y-2">
          <h2 className="smallcaps tracking-sc text-base font-medium">{title}</h2>
          {description && <p className="text-sm italic text-muted-foreground">{description}</p>}
          <p className="text-xs italic text-muted-foreground">
            Available on the {PLAN_LABELS[requiredPlan]} plan and above.
          </p>
        </div>
        <Button asChild className="mt-1">
          <Link href={href as Route}>
            {ctaLabel ?? `Upgrade to ${PLAN_LABELS[requiredPlan]}`}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
