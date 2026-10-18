import { cn } from "@/lib/utils";

// Loading placeholders are blank card stock: square, a shade darker, breathing.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse bg-secondary", className)} {...props} />;
}

export { Skeleton };
