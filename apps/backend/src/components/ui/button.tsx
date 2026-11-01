import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// "Clear sky" buttons (docs/DESIGN.md §6). `default` is the rose primary:
// at most ONE per viewport, for the screen's main action. Everything else is
// `outline` (white card, input-grey border), `ghost` or `link` (blue).
// `destructive` is the solid red fill and belongs only inside a confirmation
// dialog; elsewhere use `outline` + `text-destructive` and an icon.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-cta hover:border-primary-hover hover:bg-primary-hover active:border-primary-active active:bg-primary-active",
        outline:
          "border-input bg-card text-foreground shadow-sm hover:border-foreground/40 hover:bg-accent",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-surface-band",
        ghost: "border-transparent text-foreground hover:bg-accent",
        link: "border-transparent font-medium text-brand underline-offset-4 hover:underline",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        // Hero and final CTA only.
        xl: "h-14 rounded-xl px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    // A link reads as inline text: no horizontal padding whatever the size.
    compoundVariants: [{ variant: "link", className: "px-0" }],
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
