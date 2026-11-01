import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { offerCopy, offerFacts } from "./offer-badge";

// "What €10 gets you": the sign-up credit as three cells (calls OR CPU time,
// and the server it includes), the mandatory small print and the offer CTA.
// Figures come from offerFacts() (wallet facts + FREE_MCP_LIMIT).

/**
 * The three "what the credit buys" cells with their "or" / "Included" chips.
 * Reused by the onboarding welcome step (`size="sm"`). Server-safe.
 */
export function OfferFacts({
  locale = "en",
  size = "md",
  className,
}: {
  locale?: Locale;
  size?: "sm" | "md";
  className?: string;
}) {
  const f = offerFacts(locale);
  const [a, b, c] = f.cells;
  const sm = size === "sm";
  const cell = (x: { figure: string; label: string }) => (
    <div className={cn("grid content-start gap-1.5 rounded-2xl bg-card", sm ? "p-4" : "p-5")}>
      <span
        className={cn(
          "font-display font-extrabold leading-none tracking-tight text-primary tabular-nums",
          sm ? "text-2xl" : "text-4xl"
        )}
      >
        {x.figure}
      </span>
      <span className="text-sm text-muted-foreground">{x.label}</span>
    </div>
  );
  const joiner = (label: string) => (
    <span className="self-center justify-self-center rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold text-offer-foreground">
      {label}
    </span>
  );
  return (
    <div
      className={cn(
        "grid gap-3",
        sm ? "sm:grid-cols-[1fr_auto_1fr_auto_1fr]" : "md:grid-cols-[1fr_auto_1fr_auto_1fr]",
        className
      )}
    >
      {cell(a)}
      {joiner(f.joiners[0])}
      {cell(b)}
      {joiner(f.joiners[1])}
      {cell(c)}
    </div>
  );
}

export function OfferBand({ locale = "en" }: { locale?: Locale }) {
  const f = offerFacts(locale);
  const o = offerCopy(locale);
  return (
    <section id="offer" className="scroll-mt-20 bg-background py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          data-sticky-cta-hide
          className="grid gap-6 rounded-3xl border border-offer-border bg-offer p-6 md:gap-8 md:p-10"
        >
          <div className="grid gap-2">
            <p className="eyebrow">{f.eyebrow}</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {f.title}
            </h2>
          </div>
          <OfferFacts locale={locale} />
          <p className="max-w-4xl text-xs text-offer-foreground">{f.smallPrint}</p>
          <div>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={o.signUpHref as Route} data-cta-location="offer_band">
                {o.cta}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
