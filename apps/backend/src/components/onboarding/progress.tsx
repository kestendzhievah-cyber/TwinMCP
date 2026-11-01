import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  current: number;
  total: number;
  labels: string[];
}

// The wizard's horizontal stepper (docs/DESIGN.md, "Onboarding"): a numbered
// circle per step joined by a line. Done: a brand-blue circle with a check, and
// the line after it in brand. Current: a brand ring, its number in brand.
// Upcoming: a quiet light-blue circle. Labels sit under the circles; the
// current step is also announced through aria-current.
export function OnboardingProgress({ current, total, labels }: OnboardingProgressProps) {
  return (
    <ol className="flex w-full items-start">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === total - 1;
        return (
          <li
            key={labels[i] ?? i}
            aria-current={active ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
          >
            {/* Connector to the next step, behind the circles. */}
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-1/2 top-4 h-0.5 w-full -translate-y-1/2",
                  done ? "bg-brand" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "relative grid h-8 w-8 place-items-center rounded-full text-sm font-semibold tabular-nums",
                done && "bg-brand text-brand-foreground",
                active && "bg-card text-brand ring-2 ring-brand",
                !done && !active && "bg-secondary text-muted-foreground"
              )}
            >
              {done ? <Check aria-hidden className="h-4 w-4" /> : i + 1}
              {done && <span className="sr-only">Done:</span>}
            </span>
            <span
              className={cn(
                "max-w-full truncate px-1 text-xs",
                active ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
              )}
            >
              {labels[i]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
