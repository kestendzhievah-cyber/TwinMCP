"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOCALES, localeFromPath } from "@/lib/i18n/locales";
import { localeSwitchTargets } from "@/lib/i18n/switch";

export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const active = localeFromPath(pathname);
  // The same page in each language, translated slugs included (/plans ↔
  // /fr/tarifs). Null when one version is missing: the link would 404, so the
  // control hides itself.
  const targets = localeSwitchTargets(pathname);
  if (!targets) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center border border-border/60 bg-background p-0.5 text-xs",
        className
      )}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((loc) => {
        const isActive = loc === active;
        return (
          <Link
            key={loc}
            href={targets[loc] as Route}
            hrefLang={loc}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "smallcaps tracking-sc px-2 py-1 font-medium transition-colors",
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {loc}
          </Link>
        );
      })}
    </div>
  );
}
