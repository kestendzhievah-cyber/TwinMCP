"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { offerCopy } from "./offer-badge";

const LABEL: Record<Locale, string> = { en: "Start", fr: "Démarrer" };

/** Elements that make the bar step aside while any of them is on screen
 *  (the final CTA, the offer band, the pricing estimator): they carry their
 *  own rose button, and one rose button per viewport is the rule. */
const HIDE_SELECTOR = "[data-sticky-cta-hide]";

interface StickyMobileCtaProps {
  locale?: Locale;
  /** The element whose scrolling out of view reveals the bar (default the
   *  hero's primary button). Without it on the page, the bar shows once the
   *  visitor has scrolled one screen down. */
  triggerId?: string;
}

/**
 * A slim offer bar pinned to the bottom of phones (hidden from `md`). It shows
 * once the hero CTA has left the viewport and hides while a block with its own
 * primary button is visible. The marketing footer adds bottom padding below md
 * so the bar never covers the last links. Respects prefers-reduced-motion.
 */
export function StickyMobileCta({ locale = "en", triggerId = "hero-cta" }: StickyMobileCtaProps) {
  const o = offerCopy(locale);
  const [pastTrigger, setPastTrigger] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const trigger = document.getElementById(triggerId);
    const cleanups: Array<() => void> = [];

    if (trigger) {
      const io = new IntersectionObserver(([entry]) => {
        // Past it only once it has scrolled above the viewport, not before it.
        setPastTrigger(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
      io.observe(trigger);
      cleanups.push(() => io.disconnect());
    } else {
      const onScroll = () => setPastTrigger(window.scrollY > window.innerHeight);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }

    const visible = new Set<Element>();
    const hideIo = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setBlocked(visible.size > 0);
    });
    document.querySelectorAll(HIDE_SELECTOR).forEach((el) => hideIo.observe(el));
    cleanups.push(() => hideIo.disconnect());

    return () => cleanups.forEach((fn) => fn());
  }, [triggerId]);

  const shown = pastTrigger && !blocked;

  return (
    <div
      inert={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-lg backdrop-blur transition-[transform,visibility] duration-200 motion-reduce:transition-none md:hidden",
        shown ? "visible translate-y-0" : "invisible translate-y-full"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-offer-foreground">{o.short}</p>
        <Button asChild size="sm" className="shrink-0">
          <Link href={o.signUpHref as Route} data-cta-location="sticky_mobile">
            {LABEL[locale]}
          </Link>
        </Button>
      </div>
    </div>
  );
}
