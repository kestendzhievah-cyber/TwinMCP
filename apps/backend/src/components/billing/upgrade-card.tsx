import Link from "next/link";
import type { Route } from "next";
import { Lock, ArrowUpRight } from "lucide-react";
import type { Plan } from "@/db/schema/core";
import { PLAN_LABELS } from "@/lib/plan-features";
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
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div
          aria-hidden
          className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground"
        >
          <Lock className="h-6 w-6" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <p className="text-xs font-medium text-muted-foreground">
            Available on the {PLAN_LABELS[requiredPlan]} plan and above.
          </p>
        </div>
        <Button asChild className="mt-1">
          <Link href={href as Route}>
            {ctaLabel ?? `Upgrade to ${PLAN_LABELS[requiredPlan]}`}
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
