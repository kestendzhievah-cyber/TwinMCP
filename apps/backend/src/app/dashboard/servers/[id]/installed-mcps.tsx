"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Power, Settings, Trash2 } from "lucide-react";
import { ReconfigureDialog } from "./reconfigure-dialog";

interface Item {
  id: string;
  enabled: boolean;
  installedAt: string;
  mcpId: string;
  mcpSlug: string;
  mcpName: string;
  mcpDescription: string;
  mcpRuntime: string;
  mcpIsOfficial: boolean;
  hasConfig: boolean;
}

export function InstalledMcps({
  serverId,
  serverSlug,
  twinmcpDocsSlug,
  items,
}: {
  serverId: string;
  serverSlug: string;
  twinmcpDocsSlug: string;
  items: Item[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [reconfigureId, setReconfigureId] = useState<string | null>(null);

  async function toggle(item: Item) {
    setBusy(item.id);
    const res = await fetch(`/api/v2/servers/${serverId}/mcps/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    setBusy(null);
    if (res.ok) {
      toast.success(item.enabled ? "Disabled" : "Enabled");
      router.refresh();
    } else {
      toast.error("Failed to toggle");
    }
  }

  async function uninstall(item: Item) {
    setBusy(item.id);
    const res = await fetch(`/api/v2/servers/${serverId}/mcps/${item.id}`, {
      method: "DELETE",
    });
    setBusy(null);
    setConfirm(null);
    if (res.ok) {
      toast.success(`Uninstalled ${item.mcpName}`);
      router.refresh();
    } else {
      toast.error("Failed to uninstall");
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Installed MCPs</CardTitle>
            <CardDescription>
              <span className="lining">{items.length}</span> installed · clients call them at{" "}
              <code className="font-mono text-xs not-italic">
                /api/mcp/{serverSlug}/&lt;slug&gt;
              </code>
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href={"/dashboard/marketplace" as Route}>Browse marketplace</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {items.length === 0 ? (
          <div className="border border-dashed border-foreground/40 px-4 py-8 text-center text-sm italic text-muted-foreground">
            No MCPs installed yet.
          </div>
        ) : (
          // A ledger of installations: hairline rows, the name with its mono
          // slug and engraved labels, the actions bare at the end (DESIGN.md §4.5).
          <div className="divide-y divide-border border border-border">
            {items.map((item) => {
              const isProtected = item.mcpSlug === twinmcpDocsSlug;
              const showConfigure = !isProtected && item.hasConfig;
              return (
                <div key={item.id} className="flex items-start justify-between gap-4 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{item.mcpName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.mcpSlug}
                      </span>
                      {item.mcpIsOfficial && <Badge variant="outline">official</Badge>}
                      <Badge variant="secondary">{item.mcpRuntime}</Badge>
                      {!item.enabled && <Badge variant="warning">disabled</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.mcpDescription}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggle(item)}
                      disabled={busy === item.id}
                      aria-label={item.enabled ? "Disable" : "Enable"}
                    >
                      <Power
                        className={`h-4 w-4 ${item.enabled ? "text-success" : "text-muted-foreground"}`}
                      />
                    </Button>
                    {showConfigure && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setReconfigureId(item.id)}
                        disabled={busy === item.id}
                        aria-label="Configure"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    {!isProtected && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setConfirm(item.id)}
                        disabled={busy === item.id}
                        aria-label="Uninstall"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall MCP?</DialogTitle>
            <DialogDescription>
              This will remove the MCP from this server. You can reinstall it later from the
              marketplace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const it = items.find((i) => i.id === confirm);
                if (it) uninstall(it);
              }}
            >
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reconfigureId && (
        <ReconfigureDialog
          open={!!reconfigureId}
          onOpenChange={(open) => !open && setReconfigureId(null)}
          serverId={serverId}
          userServerId={reconfigureId}
        />
      )}
    </Card>
  );
}
