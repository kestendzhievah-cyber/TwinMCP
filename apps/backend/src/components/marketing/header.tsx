"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/funnel";
import { attributedHref } from "@/components/analytics/attribution-links";
import type { Locale } from "@/lib/i18n/locales";
import { SOCIAL_LINKS } from "@/lib/site-links";

type NavLink =
  | { href: string; label: string; kind: "anchor" }
  | { href: Route; label: string; kind: "internal" }
  | { href: string; label: string; kind: "external" };

const T = {
  en: {
    features: "Features",
    solutions: "Solutions",
    pricing: "Pricing",
    docs: "Docs",
    github: "GitHub",
    signIn: "Sign in",
    getStarted: "Get started",
    home: "TwinMCP — home",
  },
  fr: {
    features: "Fonctionnalités",
    solutions: "Solutions",
    pricing: "Tarifs",
    docs: "Docs",
    github: "GitHub",
    signIn: "Se connecter",
    getStarted: "Commencer",
    home: "TwinMCP — accueil",
  },
} as const;

function buildNav(locale: Locale, t: (typeof T)[Locale]): NavLink[] {
  // Pricing and Docs have French twins (/fr/tarifs, /fr/docs). The Features
  // anchor points at the locale's own home so it resolves there.
  const home = locale === "fr" ? "/fr" : "/";
  return [
    { href: `${home}#features`, label: t.features, kind: "anchor" },
    // Segment pages (lib/solutions/data.ts); same slug in both languages.
    {
      href: (locale === "fr" ? "/fr/solutions" : "/solutions") as Route,
      label: t.solutions,
      kind: "internal",
    },
    {
      href: (locale === "fr" ? "/fr/tarifs" : "/plans") as Route,
      label: t.pricing,
      kind: "internal",
    },
    { href: (locale === "fr" ? "/fr/docs" : "/docs") as Route, label: t.docs, kind: "internal" },
    // Shown only when NEXT_PUBLIC_GITHUB_URL is set (lib/site-links.ts).
    ...(SOCIAL_LINKS.github
      ? [{ href: SOCIAL_LINKS.github, label: t.github, kind: "external" as const }]
      : []),
  ];
}

export function MarketingHeader({ locale = "en" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const t = T[locale];
  const navLinks = buildNav(locale, t);
  const homeHref = (locale === "fr" ? "/fr" : "/") as Route;
  // French visitors sign up on the French form; English stays on /sign-up.
  const signUpHref = (locale === "fr" ? "/fr/inscription" : "/sign-up") as Route;

  const router = useRouter();

  // Landing CTAs (hero, pricing, final block…) are server-rendered, so rather
  // than shipping a client island per button, this header — mounted once on
  // every marketing page — reports clicks on any element carrying
  // `data-cta-location` as `cta_clicked`. Capture phase, so it runs before the
  // link navigates and even if a handler stops propagation.
  //
  // It also forwards the campaign keys of the current URL (utm_*, gclid, ref)
  // to sign-up / pricing / onboarding links: a Next.js <Link> navigates with
  // its React `href` prop, not the DOM href that <AttributionLinks/> rewrote,
  // so a plain left click on such a link is re-routed with the keys attached.
  // Running at the document's capture phase, the preventDefault() reaches the
  // <Link> before it navigates (it skips default-prevented clicks).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLElement>("[data-cta-location]");
      if (el) {
        track({
          name: "cta_clicked",
          properties: {
            location: el.dataset.ctaLocation ?? "unknown",
            locale,
            target: el.getAttribute("href") ?? "",
          },
        });
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const next = attributedHref(anchor);
      if (!next) return;
      event.preventDefault();
      router.push(next as Route);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [locale, router]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={homeHref} className="shrink-0" aria-label={t.home}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {navLinks.map((l) => {
            const className =
              "text-sm text-muted-foreground transition-colors hover:text-foreground";
            if (l.kind === "external") {
              return (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {l.label}
                </a>
              );
            }
            if (l.kind === "anchor") {
              return (
                <a key={l.href} href={l.href} className={className}>
                  {l.label}
                </a>
              );
            }
            return (
              <Link key={l.href} href={l.href} className={className}>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href={"/sign-in" as Route}>{t.signIn}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={signUpHref} data-cta-location="header">
              {t.getStarted}
            </Link>
          </Button>
          <LanguageSwitcher className="ml-1" />
        </div>

        {/* Phones keep one CTA in the sticky bar, next to the menu toggle. */}
        <div className="flex items-center gap-1 md:hidden">
          <Button asChild className="px-3">
            <Link href={signUpHref} data-cta-location="header_mobile">
              {t.getStarted}
            </Link>
          </Button>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className={cn("border-t border-border/60 md:hidden", open ? "block" : "hidden")}>
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
          {navLinks.map((l) => {
            const className =
              " px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground";
            if (l.kind === "external") {
              return (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              );
            }
            if (l.kind === "anchor") {
              return (
                <a key={l.href} href={l.href} className={className} onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              );
            }
            return (
              <Link key={l.href} href={l.href} className={className} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            );
          })}
          <div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={"/sign-in" as Route} onClick={() => setOpen(false)}>
                {t.signIn}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link
                href={signUpHref}
                data-cta-location="header_menu"
                onClick={() => setOpen(false)}
              >
                {t.getStarted}
              </Link>
            </Button>
            <div className="flex justify-center pt-1">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
