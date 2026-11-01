import { cn } from "@/lib/utils";

/**
 * A thin rounded progress bar for credit: by default the rose fill on the
 * soft-pink track of the offer surfaces (free credit left). Server-safe.
 */
export function CreditMeter({
  share,
  label,
  className,
  trackClassName = "bg-offer-border",
  fillClassName = "bg-primary",
}: {
  /** 0 to 1. */
  share: number;
  /** Accessible name, e.g. "Free credit left". */
  label: string;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", trackClassName, className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
          fillClassName
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
