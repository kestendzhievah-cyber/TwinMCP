import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default shadow scale; teach it the
// custom keys from tailwind.config.ts (boxShadow) so a caller's `shadow-none`
// actually replaces the default Button's `shadow-cta` instead of both classes
// surviving and CSS order deciding.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: ["cta"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
