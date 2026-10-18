import { cn } from "@/lib/utils";

// Hairline rule. `variant="double"` draws the card's double rule (section and
// page-title separators).
export function Separator({
  className,
  orientation = "horizontal",
  variant = "single",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
  variant?: "single" | "double";
}) {
  if (variant === "double" && orientation === "horizontal") {
    return <div role="separator" className={cn("rule-double w-full shrink-0", className)} />;
  }
  return (
    <div
      role="separator"
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
    />
  );
}
