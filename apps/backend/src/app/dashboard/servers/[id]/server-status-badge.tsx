"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HostType, ServerStatus } from "@/db/schema/platform";
import { lifecycleLabel } from "@/lib/server-lifecycle-label";

/**
 * Live server-status badge. Says the derived lifecycle state
 * (lib/server-lifecycle-label.ts): a `stopped` box server reads "Paused —
 * resumes on next request" or "No runtime — Start", never the raw enum. While
 * provisioning, polls /health and, on a transition, refreshes the page so the
 * controls + Runtime card update too.
 */
export function ServerStatusBadge({
  serverId,
  initialStatus,
  hostType,
  initialBoxId,
}: {
  serverId: string;
  initialStatus: ServerStatus;
  hostType: HostType;
  initialBoxId: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ServerStatus>(initialStatus);
  const [boxId, setBoxId] = useState<string | null>(initialBoxId);

  // Keep in sync when the server component re-renders with a new status.
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  useEffect(() => setBoxId(initialBoxId), [initialBoxId]);

  const view = lifecycleLabel({ status, hostType, boxId });

  useEffect(() => {
    if (!view.transient) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/v2/servers/${serverId}/health`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { status: ServerStatus; boxId?: string | null };
        if (data.status !== status) {
          setStatus(data.status);
          if (data.boxId !== undefined) setBoxId(data.boxId);
          router.refresh();
        }
      } catch {
        /* transient network error — keep polling */
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [serverId, status, view.transient, router]);

  return (
    <Badge variant={view.variant} title={view.help}>
      {/* The status dot — the one place a circle is allowed; it breathes while in flight. */}
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full bg-current", view.transient && "animate-pulse")}
      />
      {view.label}
    </Badge>
  );
}
