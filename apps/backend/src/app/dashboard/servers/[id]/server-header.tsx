import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import { ServerNav } from "./activity/server-nav";

/**
 * The header shared by the server overview, /try and /activity: a back link
 * to the list, the name with its live status, the slug in mono, the controls
 * on the right, then the section nav (underline tabs over real routes).
 */
export function ServerHeader({
  serverId,
  name,
  slug,
  status,
  actions,
}: {
  serverId: string;
  name: string;
  slug: string;
  /** The live status pill (server overview only). */
  status?: React.ReactNode;
  /** Lifecycle controls (server overview only). */
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-1">
          <Link
            href={"/dashboard/servers" as Route}
            className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Servers
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="break-words font-display text-2xl font-bold tracking-tight">{name}</h1>
            {status}
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">{slug}</p>
        </div>
        {actions}
      </div>
      <ServerNav serverId={serverId} />
    </div>
  );
}
