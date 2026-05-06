import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  current: number;
  total: number;
  labels: string[];
}

export function OnboardingProgress({ current, total, labels }: OnboardingProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                  done && "border-foreground bg-foreground text-background",
                  active && "border-foreground bg-background text-foreground",
                  !done && !active && "border-border bg-background text-muted-foreground"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < total - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 transition-colors",
                    done ? "bg-foreground" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <ol className="mt-3 flex items-start gap-2 text-[11px] uppercase tracking-wider">
        {labels.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex-1 truncate",
              i === current
                ? "text-foreground"
                : i < current
                  ? "text-muted-foreground"
                  : "text-muted-foreground/60"
            )}
          >
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
