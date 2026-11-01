import { cn } from "@/lib/utils";

// Loading placeholders: a soft light-blue block, rounded, breathing (the
// pulse stops under prefers-reduced-motion, see globals.css).
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-secondary", className)} {...props} />;
}

export { Skeleton };
