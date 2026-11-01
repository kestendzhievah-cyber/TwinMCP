import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

// Multi-line field with the same border, focus and invalid states as Input.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("flex min-h-[80px] py-2", fieldClasses, className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
