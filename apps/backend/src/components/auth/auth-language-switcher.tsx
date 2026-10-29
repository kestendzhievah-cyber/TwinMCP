"use client";

import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { authSwitchTargets } from "@/lib/i18n/auth-switch";

// The EN · FR stamp of the marketing header, for the auth screens: the same
// page in the other language with its query kept (lib/i18n/auth-switch.ts).
// Hidden where there is no twin to switch to.
function Switcher({ locale, search }: { locale: Locale; search: string }) {
  const pathname = usePathname() ?? "/";
  const targets = authSwitchTargets(pathname, search);
  if (!targets) return null;
  return (
    <div
      className="inline-flex items-center border border-border/60 bg-background p-0.5 text-xs"
      role="group"
      aria-label={locale === "fr" ? "Langue" : "Language"}
    >
      {LOCALES.map((loc) => {
        const isActive = loc === locale;
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

function WithQuery({ locale }: { locale: Locale }) {
  const params = useSearchParams();
  return <Switcher locale={locale} search={params?.toString() ?? ""} />;
}

export function AuthLanguageSwitcher({ locale }: { locale: Locale }) {
  // useSearchParams needs a Suspense boundary on prerendered pages; until it
  // resolves, the switcher links without the query.
  return (
    <Suspense fallback={<Switcher locale={locale} search="" />}>
      <WithQuery locale={locale} />
    </Suspense>
  );
}
