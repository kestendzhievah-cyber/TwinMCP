"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LOCALES,
  hasFrenchVersion,
  localeFromPath,
  stripLocalePrefix,
  type Locale,
} from "@/lib/i18n/locales";

// Toggle the locale prefix on the current pathname.
function altPath(stripped: string, target: Locale): string {
  return target === "en" ? stripped : `/fr${stripped === "/" ? "" : stripped}`;
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const stripped = stripLocalePrefix(pathname);
  const active = localeFromPath(pathname);

  // Only render when a real toggle exists: on English pages with no French twin
  // the FR link would 404, so hide the control entirely. (On a /fr page the
  // English origin always exists, so hasFrenchVersion is true there too.)
  if (!hasFrenchVersion(stripped)) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border/60 bg-background p-0.5 text-xs",
        className
      )}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((loc) => {
        const isActive = loc === active;
        const target = altPath(stripped, loc);
        return (
          <Link
            key={loc}
            href={target as Route}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded px-2 py-1 font-medium uppercase tracking-wide transition-colors",
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
