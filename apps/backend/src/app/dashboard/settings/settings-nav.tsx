"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE = "/dashboard/settings";

const ITEMS = [
  { href: BASE, label: "General" },
  { href: `${BASE}/secrets`, label: "Secrets" },
  { href: `${BASE}/connectors`, label: "Connectors" },
  { href: `${BASE}/webhooks`, label: "Webhooks" },
] as const;

/**
 * Settings index line: General · Secrets · Connectors · Webhooks. Same type as
 * the server sections nav (small capitals on a hairline, the current page
 * underscored in ink); each entry is a real route.
 */
export function SettingsNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Settings sections"
      className="flex h-10 items-end gap-6 overflow-x-auto border-b border-border"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === BASE
            ? pathname === BASE || pathname === `${BASE}/`
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "smallcaps tracking-sc relative -mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
