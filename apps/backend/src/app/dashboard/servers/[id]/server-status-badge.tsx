"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServerStatus } from "@/db/schema/platform";

// Status tints (DESIGN.md §4.9): running green, provisioning ochre, stopped
// plain stock, error oxblood, destroyed an empty outline.
const VARIANT: Record<
  ServerStatus,
  "success" | "secondary" | "warning" | "destructive" | "outline"
> = {
  running: "success",
  provisioning: "warning",
  stopped: "secondary",
  error: "destructive",
  destroyed: "outline",
};

// Plain-language explanation of each status, shown on hover so the raw enum
// isn't the only signal (esp. `error`, which otherwise reads as a dead end).
const HELP: Record<ServerStatus, string> = {
  running: "Online and serving MCP requests.",
  provisioning: "Spinning up your runtime — usually about 30 seconds.",
  stopped: "Sleeping to save resources. Start it to wake it up.",
  error: "The runtime failed to start. Check the Logs tab, or restart the server.",
  destroyed: "This server has been torn down.",
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

  return (
    <Badge variant={VARIANT[status]} title={HELP[status]} className="capitalize">
      {/* The status dot — the one place a circle is allowed; it breathes while in flight. */}
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          TRANSIENT.includes(status) && "animate-pulse"
        )}
      />
      {status}
    </Badge>
  );
}
