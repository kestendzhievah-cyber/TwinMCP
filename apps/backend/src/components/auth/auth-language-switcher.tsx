"use client";

import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { authSwitchTargets } from "@/lib/i18n/auth-switch";

// The EN · FR switch of the marketing header, for the auth screens: the same
// page in the other language with its query kept (lib/i18n/auth-switch.ts).
// A small segmented control, the current language selected in brand blue.
// Hidden where there is no twin to switch to.
function Switcher({ locale, search }: { locale: Locale; search: string }) {
  const pathname = usePathname() ?? "/";
  const targets = authSwitchTargets(pathname, search);
  if (!targets) return null;
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-xs"
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
              "inline-flex min-h-9 items-center rounded-md px-2.5 font-semibold uppercase transition-colors",
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
