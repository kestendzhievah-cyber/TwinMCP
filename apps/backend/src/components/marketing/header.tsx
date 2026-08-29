"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";

type NavLink =
  | { href: string; label: string; kind: "anchor" }
  | { href: Route; label: string; kind: "internal" }
  | { href: string; label: string; kind: "external" };

const T = {
  en: {
    features: "Features",
    pricing: "Pricing",
    docs: "Docs",
    github: "GitHub",
    signIn: "Sign in",
    getStarted: "Get started",
    home: "TwinMCP — home",
  },
  fr: {
    features: "Fonctionnalités",
    pricing: "Tarifs",
    docs: "Docs",
    github: "GitHub",
    signIn: "Se connecter",
    getStarted: "Commencer",
    home: "TwinMCP — accueil",
  },
} as const;

function buildNav(locale: Locale, t: (typeof T)[Locale]): NavLink[] {
  // Docs/Pricing pages are English-only, so their hrefs stay unprefixed. The
  // Features anchor points at the locale's own home so it resolves there.
  const home = locale === "fr" ? "/fr" : "/";
  return [
    { href: `${home}#features`, label: t.features, kind: "anchor" },
    { href: "/plans" as Route, label: t.pricing, kind: "internal" },
    { href: "/docs" as Route, label: t.docs, kind: "internal" },
    { href: "https://github.com/kestendzhievah-cyber/TwinMCP", label: t.github, kind: "external" },
  ];
}

export function MarketingHeader({ locale = "en" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const t = T[locale];
  const navLinks = buildNav(locale, t);
  const homeHref = (locale === "fr" ? "/fr" : "/") as Route;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
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
            <Link href={"/sign-up" as Route}>{t.getStarted}</Link>
          </Button>
          <LanguageSwitcher className="ml-1" />
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn("border-t border-border/60 md:hidden", open ? "block" : "hidden")}>
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
          {navLinks.map((l) => {
            const className =
              "rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground";
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
              <Link href={"/sign-up" as Route} onClick={() => setOpen(false)}>
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
