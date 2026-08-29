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
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Installed MCPs</CardTitle>
            <CardDescription>
              {items.length} installed · clients call them at{" "}
              <code className="font-mono text-xs">/api/mcp/{serverSlug}/&lt;slug&gt;</code>
            </CardDescription>
          </div>
          <Link href={"/dashboard/marketplace" as Route}>
            <Button variant="outline" size="sm">
              Browse marketplace
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No MCPs installed yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isProtected = item.mcpSlug === twinmcpDocsSlug;
              const showConfigure = !isProtected && item.hasConfig;
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-md border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.mcpName}</span>
                      {item.mcpIsOfficial && (
                        <Badge variant="outline" className="text-xs">
                          official
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {item.mcpRuntime}
                      </Badge>
                      {!item.enabled && (
                        <Badge variant="warning" className="text-xs">
                          disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.mcpDescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggle(item)}
                      disabled={busy === item.id}
                      aria-label={item.enabled ? "Disable" : "Enable"}
                    >
                      <Power
                        className={`h-4 w-4 ${item.enabled ? "text-green-600" : "text-muted-foreground"}`}
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
