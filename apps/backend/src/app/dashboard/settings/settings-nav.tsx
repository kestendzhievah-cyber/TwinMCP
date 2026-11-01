"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { KeyRound, Plug, SlidersHorizontal, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/dashboard/settings";

const ITEMS = [
  { href: BASE, label: "General", icon: SlidersHorizontal },
  { href: `${BASE}/secrets`, label: "Secrets", icon: KeyRound },
  { href: `${BASE}/connectors`, label: "Connectors", icon: Plug },
  { href: `${BASE}/webhooks`, label: "Webhooks", icon: Webhook },
] as const;

/**
 * Settings section nav: General · Secrets · Connectors · Webhooks; each entry
 * is a real route. Phones get an underline tab row (the current page
 * underscored in brand blue); from md up it becomes a vertical list with the
 * same item style as the dashboard sidebar (active = brand tint).
 */
export function SettingsNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Settings sections"
      className="flex h-10 items-end gap-6 overflow-x-auto border-b border-border md:sticky md:top-6 md:h-auto md:flex-col md:items-stretch md:gap-1 md:overflow-visible md:border-b-0"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === BASE
            ? pathname === BASE || pathname === `${BASE}/`
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              // Phones: underline tab.
              "relative -mb-px inline-flex h-10 shrink-0 items-center gap-3 whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              // md+: sidebar-style list item.
              "md:mb-0 md:h-auto md:rounded-lg md:border-b-0 md:px-3 md:py-2 md:hover:bg-accent",
              active
                ? "border-brand text-foreground md:bg-brand/10 md:font-semibold md:text-brand md:hover:bg-brand/10 md:hover:text-brand"
                : "border-transparent text-muted-foreground"
            )}
          >
            <Icon aria-hidden className="hidden size-4 shrink-0 md:block" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
