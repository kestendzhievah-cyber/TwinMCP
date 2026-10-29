"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The server's page-level index line: Overview · Try it · Activity. Same type
 * as the Tabs primitive (small capitals on a hairline, the current page
 * underscored in ink) but each entry is a real route, so it survives reloads
 * and can be linked to. Shared by the server overview, /try and /activity.
 */
export function ServerNav({ serverId }: { serverId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/servers/${serverId}`;
  const items = [
    { href: base, label: "Overview", active: pathname === base || pathname === `${base}/` },
    { href: `${base}/try`, label: "Try it", active: pathname.startsWith(`${base}/try`) },
    {
      href: `${base}/activity`,
      label: "Activity",
      active: pathname.startsWith(`${base}/activity`),
    },
  ];

  return (
    <nav
      aria-label="Server sections"
      className="flex h-10 items-end gap-6 overflow-x-auto border-b border-border"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href as Route}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "smallcaps tracking-sc relative -mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            item.active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
