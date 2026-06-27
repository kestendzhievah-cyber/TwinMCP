"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { ServerStatus } from "@/db/schema/platform";

const VARIANT: Record<ServerStatus, "success" | "secondary" | "warning" | "destructive"> = {
  running: "success",
  provisioning: "warning",
  stopped: "secondary",
  error: "destructive",
  destroyed: "secondary",
};

// Only poll while the status is in-flight; settled states don't change on their own.
const TRANSIENT: ServerStatus[] = ["provisioning"];

/**
 * Live server-status badge. While the status is transient (provisioning), polls
 * /health and, on a transition, refreshes the page so the controls + Runtime card
 * update too. Replaces the static badge so the user no longer has to reload.
 */
export function ServerStatusBadge({
  serverId,
  initialStatus,
}: {
  serverId: string;
  initialStatus: ServerStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ServerStatus>(initialStatus);

  // Keep in sync when the server component re-renders with a new status.
  useEffect(() => setStatus(initialStatus), [initialStatus]);

  useEffect(() => {
    if (!TRANSIENT.includes(status)) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/v2/servers/${serverId}/health`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { status: ServerStatus };
        if (data.status !== status) {
          setStatus(data.status);
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
  }, [serverId, status, router]);

  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}
