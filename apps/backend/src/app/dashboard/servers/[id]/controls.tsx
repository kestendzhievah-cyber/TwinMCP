"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pause, Play, RotateCw, ServerOff, Trash2 } from "lucide-react";
import type { HostType, ServerStatus } from "@/db/schema/platform";
import {
  DELETE_RUNTIME_KEEPS,
  DELETE_RUNTIME_LOSES,
  deleteRuntimeConfirmed,
  lifecycleActions,
} from "@/lib/server-lifecycle";

type Busy = "start" | "pause" | "restart" | "runtime" | "delete" | null;
type Confirm = "pause" | "restart" | "runtime" | "delete" | null;

// Destructive actions outside a confirmation dialog are outline + red text +
// an icon; the solid red button lives only inside the dialog.
const destructiveOutline =
  "border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive";

/**
 * Server lifecycle controls (contract K4):
 *   Pause          the box is paused, its data kept; next request or Resume wakes it.
 *   Resume/Start   wake a paused box in place, or create a runtime when none exists.
 *   Restart        recreate the runtime from the saved configs (deletes the
 *                  box: typed confirmation, like Delete runtime).
 *   Delete runtime destroy the box and its data, keep the server and its configs.
 *   Delete         remove the server entirely.
 */
export function ServerControls({
  serverId,
  serverName,
  status,
  hostType,
  boxId,
}: {
  serverId: string;
  serverName: string;
  status: ServerStatus;
  hostType: HostType;
  boxId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [typedName, setTypedName] = useState("");

  const actions = lifecycleActions({ status, hostType, boxId });

  function openConfirm(which: Confirm) {
    setTypedName("");
    setConfirm(which);
  }

  async function request(
    kind: Exclude<Busy, null>,
    url: string,
    init: RequestInit,
    success: string
  ): Promise<boolean> {
    setBusy(kind);
    try {
      const res = await fetch(url, init);
      if (res.ok) {
        toast.success(success);
        return true;
      }
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(err.message ?? "Something went wrong");
      return false;
    } catch {
      toast.error("Network error, please retry");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    const ok = await request(
      "start",
      `/api/v2/servers/${serverId}/start`,
      { method: "POST" },
      actions.resume ? "Server resumed" : "Server starting"
    );
    if (ok) router.refresh();
  }

  async function pause() {
    const ok = await request(
      "pause",
      `/api/v2/servers/${serverId}/pause`,
      { method: "POST" },
      "Server paused, data kept"
    );
    setConfirm(null);
    if (ok) router.refresh();
  }

  async function restart() {
    const ok = await request(
      "restart",
      `/api/v2/servers/${serverId}/restart`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmName: typedName }),
      },
      "Server restarting on a fresh runtime"
    );
    if (ok) {
      setConfirm(null);
      setTimeout(() => router.refresh(), 800);
    }
  }

  async function deleteRuntime() {
    const ok = await request(
      "runtime",
      `/api/v2/servers/${serverId}/runtime`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmName: typedName }),
      },
      "Runtime deleted. Configs kept."
    );
    if (ok) {
      setConfirm(null);
      router.refresh();
    }
  }

  async function deleteServer() {
    const ok = await request(
      "delete",
      `/api/v2/servers/${serverId}`,
      { method: "DELETE" },
      "Server deleted"
    );
    if (ok) router.push("/dashboard/servers" as Route);
  }

  const nameConfirmed = deleteRuntimeConfirmed(typedName, serverName);
  const onOpenChange = (open: boolean) => {
    if (!open && !busy) setConfirm(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(actions.resume || actions.start) && (
        <Button variant="outline" onClick={start} disabled={!!busy}>
          <Play className="h-4 w-4" />
          {actions.resume
            ? busy === "start"
              ? "Resuming…"
              : "Resume"
            : busy === "start"
              ? "Starting…"
              : "Start"}
        </Button>
      )}
      {actions.pause && (
        <Button variant="outline" onClick={() => openConfirm("pause")} disabled={!!busy}>
          <Pause className="h-4 w-4" />
          Pause
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => openConfirm("delete")}
        disabled={!!busy}
        className={destructiveOutline}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
      {/* Rarer runtime actions live in an overflow menu. Non-modal, so the
          confirmation dialog it opens gets the focus cleanly. */}
      {(actions.restart || actions.deleteRuntime) && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" disabled={!!busy} aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {actions.restart && (
              <DropdownMenuItem onSelect={() => openConfirm("restart")}>
                <RotateCw aria-hidden className="h-4 w-4" />
                Restart
              </DropdownMenuItem>
            )}
            {actions.deleteRuntime && (
              <DropdownMenuItem
                onSelect={() => openConfirm("runtime")}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <ServerOff aria-hidden className="h-4 w-4" />
                Delete runtime
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Pause: light confirmation, nothing is lost. */}
      <Dialog open={confirm === "pause"} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause this server?</DialogTitle>
            <DialogDescription>
              The box is paused and everything on it is kept: installed packages, files your MCPs
              wrote and logs. The next MCP request wakes it after a short delay, or press Resume.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={!!busy}>
              Cancel
            </Button>
            <Button onClick={pause} disabled={busy === "pause"}>
              {busy === "pause" ? "Pausing…" : "Pause"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restart recreates the runtime (the box is deleted): typed confirmation,
          checked again by the API, and a pointer to Pause for keeping data. */}
      <Dialog open={confirm === "restart"} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restart on a fresh runtime?</DialogTitle>
            <DialogDescription>
              Restart deletes the current box and creates a fresh one, reinstalling every MCP from
              its saved configuration. Files written inside the current box are lost. To stop
              serving and keep them, use Pause instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Label htmlFor="confirm-restart-name">
              Type <span className="font-mono">{serverName}</span> to confirm
            </Label>
            <Input
              id="confirm-restart-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameConfirmed && !busy) void restart();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={restart}
              disabled={!nameConfirmed || busy === "restart"}
            >
              {busy === "restart" ? "Restarting…" : "Restart"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete runtime: destructive, typed confirmation. */}
      <Dialog open={confirm === "runtime"} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this server&apos;s runtime?</DialogTitle>
            <DialogDescription>This cannot be undone. It permanently deletes:</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 py-3 pl-8 pr-4 text-destructive">
              {DELETE_RUNTIME_LOSES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">{DELETE_RUNTIME_KEEPS}</p>
            <div className="space-y-2">
              <Label htmlFor="confirm-runtime-name">
                Type <span className="font-mono">{serverName}</span> to confirm
              </Label>
              <Input
                id="confirm-runtime-name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameConfirmed && !busy) void deleteRuntime();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteRuntime}
              disabled={!nameConfirmed || busy === "runtime"}
            >
              {busy === "runtime" ? "Deleting…" : "Delete runtime"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete server. */}
      <Dialog open={confirm === "delete"} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this server?</DialogTitle>
            <DialogDescription>
              The server is removed with its runtime (the box and everything on it), its installed
              MCPs and their saved configuration. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={!!busy}>
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
