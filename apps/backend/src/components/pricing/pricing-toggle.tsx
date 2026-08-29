"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BillingCadence } from "./pricing-data";
import type { Locale } from "@/lib/i18n/locales";

interface PricingToggleProps {
  cadence: BillingCadence;
  onChange: (next: BillingCadence) => void;
  locale?: Locale;
}

const TOGGLE = {
  en: { aria: "Billing cadence", monthly: "Monthly", annual: "Annual", save: "Save up to 25%" },
  fr: {
    aria: "Fréquence de facturation",
    monthly: "Mensuel",
    annual: "Annuel",
    save: "Jusqu’à 25 % d’économie",
  },
} as const;

export function PricingToggle({ cadence, onChange, locale = "en" }: PricingToggleProps) {
  const t = TOGGLE[locale];
  return (
    <div className="inline-flex items-center gap-3">
      <div
        role="tablist"
        aria-label={t.aria}
        className="inline-flex rounded-full border border-border/80 bg-card p-1 text-sm"
      >
        <ToggleButton
          active={cadence === "monthly"}
          onClick={() => onChange("monthly")}
          label={t.monthly}
        />
        <ToggleButton
          active={cadence === "annual"}
          onClick={() => onChange("annual")}
          label={t.annual}
        />
      </div>
      <Badge
        variant="secondary"
        className={cn("transition-opacity", cadence === "annual" ? "opacity-100" : "opacity-60")}
      >
        {t.save}
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
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
