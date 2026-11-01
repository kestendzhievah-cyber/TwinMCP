"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { HostType, ServerStatus } from "@/db/schema/platform";
import { lifecycleLabel } from "@/lib/server-lifecycle-label";
import { LifecycleBadge } from "../lifecycle-badge";

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

  return <LifecycleBadge view={view} className="whitespace-normal" />;
}
