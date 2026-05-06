"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BillingCadence } from "./pricing-data";
import { ANNUAL_DISCOUNT_PCT } from "./pricing-data";

interface PricingToggleProps {
  cadence: BillingCadence;
  onChange: (next: BillingCadence) => void;
}

export function PricingToggle({ cadence, onChange }: PricingToggleProps) {
  return (
    <div className="inline-flex items-center gap-3">
      <div
        role="tablist"
        aria-label="Billing cadence"
        className="inline-flex rounded-full border border-border/80 bg-card p-1 text-sm"
      >
        <ToggleButton
          active={cadence === "monthly"}
          onClick={() => onChange("monthly")}
          label="Monthly"
        />
        <ToggleButton
          active={cadence === "annual"}
          onClick={() => onChange("annual")}
          label="Annual"
        />
      </div>
      <Badge
        variant="secondary"
        className={cn(
          "transition-opacity",
          cadence === "annual" ? "opacity-100" : "opacity-60"
        )}
      >
        Save {ANNUAL_DISCOUNT_PCT}%
      </Badge>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
