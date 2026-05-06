"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Square, RotateCw, Trash2 } from "lucide-react";
import type { ServerStatus } from "@/db/schema/platform";

export function ServerControls({
  serverId,
  status,
}: {
  serverId: string;
  status: ServerStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function call(action: "start" | "stop" | "restart") {
    setBusy(action);
    const res = await fetch(`/api/v2/servers/${serverId}/${action}`, { method: "POST" });
    setBusy(null);
    if (res.ok) {
      toast.success(`Server ${action}ing`);
      setTimeout(() => router.refresh(), 800);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? `Failed to ${action}`);
    }
  }

  async function deleteServer() {
    setBusy("delete");
    const res = await fetch(`/api/v2/servers/${serverId}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      toast.success("Server deleted");
      router.push("/dashboard/servers" as Route);
    } else {
      toast.error("Failed to delete");
    }
  }

  const canStart = status === "stopped" || status === "error";
  const canStop = status === "running" || status === "provisioning";

  return (
    <div className="flex items-center gap-2">
      {canStart && (
        <Button variant="outline" size="sm" onClick={() => call("start")} disabled={!!busy}>
          <Play className="h-4 w-4" />
          {busy === "start" ? "Starting…" : "Start"}
        </Button>
      )}
      {canStop && (
        <Button variant="outline" size="sm" onClick={() => call("stop")} disabled={!!busy}>
          <Square className="h-4 w-4" />
          {busy === "stop" ? "Stopping…" : "Stop"}
        </Button>
      )}
      {status === "running" && (
        <Button variant="outline" size="sm" onClick={() => call("restart")} disabled={!!busy}>
          <RotateCw className="h-4 w-4" />
          {busy === "restart" ? "Restarting…" : "Restart"}
        </Button>
      )}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          disabled={!!busy}
          className="text-destructive hover:bg-destructive/5"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this server?</DialogTitle>
            <DialogDescription>
              The Upstash Box runtime and all installed MCPs will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteServer} disabled={busy === "delete"}>
              {busy === "delete" ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
