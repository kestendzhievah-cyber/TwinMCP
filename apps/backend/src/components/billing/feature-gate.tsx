import type { Plan } from "@/db/schema/core";
import { meetsPlan } from "@/lib/plan-features";
import { UpgradeCard } from "./upgrade-card";

interface FeatureGateProps {
  /** The current user's plan. */
  plan: Plan;
  /** Minimum plan required to see the children. */
  requiredPlan: Plan;
  title: string;
  description?: React.ReactNode;
  ctaLabel?: string;
  children: React.ReactNode;
}

/**
 * Renders `children` when the user's plan is high enough, otherwise an
 * UpgradeCard. This is a UI convenience only — never the security boundary.
 * Enforce access on the server (see lib/plan-features.ts helpers) regardless
 * of what the gate renders.
 */
export function FeatureGate({
  plan,
  requiredPlan,
  title,
  description,
  ctaLabel,
  children,
}: FeatureGateProps) {
  if (meetsPlan(plan, requiredPlan)) return <>{children}</>;
  return (
    <UpgradeCard
      title={title}
      description={description}
      requiredPlan={requiredPlan}
      ctaLabel={ctaLabel}
    />
  );
}
