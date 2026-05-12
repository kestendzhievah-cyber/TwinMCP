"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

// Detects the current locale from the URL and offers a switch to the others.
// Server-side equivalent could be made, but the language switcher only
// renders inside the marketing footer — client-side is fine.
function detectLocale(pathname: string): Locale {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (seg && (LOCALES as string[]).includes(seg)) return seg as Locale;
  return DEFAULT_LOCALE;
}

function stripLocale(pathname: string, current: Locale): string {
  if (current === DEFAULT_LOCALE) return pathname || "/";
  const prefix = `/${current}`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || "/" : pathname;
}

export function LanguageSwitcher() {
  const pathname = usePathname() ?? "/";
  const current = detectLocale(pathname);
  const basePath = stripLocale(pathname, current);

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
