import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  current: number;
  total: number;
  labels: string[];
}

// The card's index line, set as a ledger: one row between two hairlines, a
// cell per step divided by hairlines, each a lining numeral and a small-capital
// label. Finished steps carry a check, the current one is underscored in ink
// and set in medium, the steps to come keep their numeral (DESIGN.md §4.5).
export function OnboardingProgress({ current, total, labels }: OnboardingProgressProps) {
  return (
    <ol className="flex w-full divide-x divide-border border-y border-border">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={labels[i] ?? i}
            aria-current={active ? "step" : undefined}
            className={cn(
              "relative flex min-w-0 flex-auto flex-col gap-0.5 px-2 py-2 transition-colors sm:flex-row sm:items-center sm:gap-2 sm:px-3",
              active &&
                "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:content-['']",
              !active && "text-muted-foreground"
            )}
          >
            <span className="lining flex h-5 items-center text-xs font-medium">
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("smallcaps tracking-sc truncate text-xs", active && "font-medium")}>
              {labels[i]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
