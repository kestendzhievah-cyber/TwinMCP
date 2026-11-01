"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOCALES, LOCALE_LABELS, localeFromPath } from "@/lib/i18n/locales";
import { localeSwitchTargets } from "@/lib/i18n/switch";

// A two-segment EN | FR control. The current language is the selected chip
// (brand blue, spec §2.4), the other one a plain link.
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
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-xs font-semibold",
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
            lang={loc}
            title={LOCALE_LABELS[loc]}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-7 min-w-8 items-center justify-center rounded-md px-2 uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {loc}
          </Link>
        );
      })}
    </div>
  );
}
