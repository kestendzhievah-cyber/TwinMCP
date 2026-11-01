import * as React from "react";
import { cn } from "@/lib/utils";

// A card is a white panel on the light-blue page: 16px radius, one hairline,
// a soft navy shadow. Padding comes from --card-padding (20px on phones, 24px
// from sm) so a caller's `p-0` or `pt-6` still overrides it.
// `data-slot="card"` lets nested primitives (Table) drop their own frame.
// Recipes (className, not variants):
//   interactive  `transition hover:border-input hover:shadow-md`
//   offer        `border-offer-border bg-offer`
//   selected     `border-brand ring-1 ring-brand`
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-[var(--card-padding)]", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

// Renders a real heading (h3 by default) so pages keep a proper document
// outline for screen-reader heading navigation. Override with `as` where a
// different level fits (e.g. a top-level section title -> as="h2").
type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3" | "h4";
};
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Comp = "h3", ...props }, ref) => (
    <Comp
      ref={ref}
      className={cn("font-display text-lg font-semibold leading-snug tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-[var(--card-padding)] pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-[var(--card-padding)] pt-0", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
