"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOCALES, type Locale } from "@/lib/i18n/locales";

// Toggle the locale prefix on the current pathname. The router auto-resolves
// the target route — if no FR equivalent exists, Next renders 404 (acceptable
// fallback). Keeping it stateless and link-based means no client roundtrip.
function altPath(pathname: string, target: Locale): string {
  const stripped = pathname.replace(/^\/fr(?=\/|$)/, "") || "/";
  return target === "en" ? stripped : `/fr${stripped === "/" ? "" : stripped}`;
}

function currentLocale(pathname: string): Locale {
  return pathname === "/fr" || pathname.startsWith("/fr/") ? "fr" : "en";
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const active = currentLocale(pathname);

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
        const target = altPath(pathname, loc);
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
