"use client";

import { cn } from "@/lib/utils";

/**
 * The usage pages' time-window chips (7d / 30d / 90d): a compact segmented
 * group, the chosen window selected in brand blue.
 */
export function RangeChips({
  ranges,
  value,
  onChange,
  isDisabled,
  titleFor,
}: {
  ranges: readonly number[];
  value: number;
  onChange: (days: number) => void;
  isDisabled?: (days: number) => boolean;
  titleFor?: (days: number) => string | undefined;
}) {
  return (
    <div
      role="group"
      aria-label="Range"
      className="inline-flex items-center gap-0.5 rounded-lg border border-input bg-card p-0.5"
    >
      {ranges.map((r) => {
        const disabled = isDisabled?.(r) ?? false;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            aria-pressed={value === r}
            disabled={disabled}
            title={titleFor?.(r)}
            className={cn(
              "h-9 min-w-12 rounded-md px-3 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
              value === r
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {r}d
          </button>
        );
      })}
    </div>
  );
}
