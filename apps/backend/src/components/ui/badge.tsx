import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Badges are tiny engraved labels: square, hairline, small capitals. Semantic
// variants use the design-system accents as a 10% tint + text, never a fill.
const badgeVariants = cva(
  "smallcaps tracking-sc inline-flex items-center gap-1 border px-2 py-px text-xs font-medium leading-5 transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-foreground/60 bg-transparent text-foreground",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive",
        success: "border-success/40 bg-success/10 text-success",
        warning: "border-warning/40 bg-warning/10 text-warning",
        info: "border-info/40 bg-info/10 text-info",
        brand: "border-brand/40 bg-brand/10 text-brand",
        gilt: "border-gilt/50 bg-gilt/10 text-gilt",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
