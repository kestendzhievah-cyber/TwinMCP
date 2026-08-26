"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import {
  LOCALES,
  LOCALE_LABELS,
  DEFAULT_LOCALE,
  hasFrenchVersion,
  localeFromPath,
  stripLocalePrefix,
} from "@/lib/i18n/locales";

export function LanguageSwitcher() {
  const pathname = usePathname() ?? "/";
  const current = localeFromPath(pathname);
  const basePath = stripLocalePrefix(pathname);

  // Hide when there's no French twin to switch to (would 404). Shares the same
  // allow-list as the header switcher so both stay consistent.
  if (!hasFrenchVersion(basePath)) return null;

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex items-center gap-1 text-xs">
        {LOCALES.map((loc, i) => {
          const target =
            loc === DEFAULT_LOCALE ? basePath : `/${loc}${basePath === "/" ? "" : basePath}`;
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
                  href={target as Route}
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
