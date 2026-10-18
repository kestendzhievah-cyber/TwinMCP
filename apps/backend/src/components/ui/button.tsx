import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Buttons are typeset like the card: small capitals, letterspaced, square,
// hairline or ink-filled. `outline` inverts to an ink stamp on hover; every
// variant presses down 1px on :active (letterpress). See docs/DESIGN.md.
const buttonVariants = cva(
  "smallcaps tracking-sc inline-flex items-center justify-center gap-2 whitespace-nowrap border font-medium transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-foreground/60 bg-transparent text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:border-foreground/50",
        ghost: "border-transparent text-foreground/80 hover:bg-secondary hover:text-foreground",
        link: "no-smallcaps border-transparent font-normal text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
