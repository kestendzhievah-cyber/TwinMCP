"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_LABELS, localeFromPath } from "@/lib/i18n/locales";
import { localeSwitchTargets } from "@/lib/i18n/switch";

export function LanguageSwitcher() {
  const pathname = usePathname() ?? "/";
  const current = localeFromPath(pathname);
  // Same targets as the header switcher (translated slugs included), and the
  // same rule: hidden when the other version does not exist (would 404).
  const targets = localeSwitchTargets(pathname);
  if (!targets) return null;

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex items-center gap-1 text-xs">
        {LOCALES.map((loc, i) => {
          const isCurrent = loc === current;
          return (
            <span key={loc} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
              )}
              {isCurrent ? (
                <span className="font-medium text-foreground" aria-current="true">
                  {LOCALE_LABELS[loc]}
                </span>
              ) : (
                <Link
                  href={targets[loc] as Route}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  hrefLang={loc}
                >
                  {LOCALE_LABELS[loc]}
                </Link>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
