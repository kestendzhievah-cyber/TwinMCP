import { Check } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { offerCopy } from "@/components/marketing/offer-badge";

/**
 * The offer's terms line (docs/DESIGN.md, "Copy rules"), printed under every
 * sign-up CTA so the free credit is never oversold: valid N days, no card, no
 * subscription, stops at zero. The terms are the shared offer copy
 * (components/marketing/offer-badge.tsx, rendered from the wallet facts); this
 * wrapper adds the alignment the pricing pages and creator landings need.
 */
export function TrustSignals({
  locale = "en",
  align = "center",
  className,
}: {
  locale?: Locale;
  /** "center" (default) for centred heroes and panels, "start" for left-aligned copy. */
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground",
        align === "center" ? "justify-center" : "justify-start",
        className
      )}
    >
      {offerCopy(locale).terms.map((label) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
