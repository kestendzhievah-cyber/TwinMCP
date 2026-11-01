import * as React from "react";
import { cn } from "@/lib/utils";

// Form fields are white, 10px radius, with the 3:1 `input` border. Focus
// swaps the border to brand blue with a soft 3px halo; `aria-invalid` turns
// it red (pair it with an error message, never colour alone).
// Shared with Textarea and the Select trigger.
export const fieldClasses =
  "w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        fieldClasses,
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
