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
import { ListChecks, Power, Settings, Store, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { McpLogo } from "@/app/dashboard/marketplace/mcp-logo";
import { ReconfigureDialog } from "./reconfigure-dialog";
import { ToolPolicyDialog } from "./tool-policy-dialog";

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
  const [policyItem, setPolicyItem] = useState<Item | null>(null);

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
          <div className="min-w-0 space-y-1.5">
            <CardTitle as="h2">Installed MCPs</CardTitle>
            <CardDescription>
              <span className="tabular-nums">{items.length}</span> installed · clients call them at{" "}
              <code className="break-all font-mono text-xs">
                /api/mcp/{serverSlug}/&lt;slug&gt;
              </code>
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href={"/dashboard/marketplace" as Route}>
              <Store className="h-4 w-4" />
              Browse marketplace
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5 sm:pt-6">
        {items.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No MCPs installed yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const isProtected = item.mcpSlug === twinmcpDocsSlug;
              const showConfigure = !isProtected && item.hasConfig;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between",
                    !item.enabled && "bg-secondary/50"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <McpLogo slug={item.mcpSlug} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">{item.mcpName}</span>
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
                  </div>
                  <div className="-mr-2 flex shrink-0 items-center gap-1 self-end sm:self-start">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggle(item)}
                      disabled={busy === item.id}
                      aria-label={item.enabled ? "Disable" : "Enable"}
                      title={item.enabled ? "Disable" : "Enable"}
                    >
                      <Power
                        className={cn(
                          "h-4 w-4",
                          item.enabled ? "text-success" : "text-muted-foreground"
                        )}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPolicyItem(item)}
                      disabled={busy === item.id}
                      aria-label="Tool access"
                      title="Tool access"
                    >
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    {showConfigure && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setReconfigureId(item.id)}
                        disabled={busy === item.id}
                        aria-label="Configure"
                        title="Configure"
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
                        title="Uninstall"
                        className="hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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

      {policyItem && (
        <ToolPolicyDialog
          open={!!policyItem}
          onOpenChange={(open) => !open && setPolicyItem(null)}
          serverId={serverId}
          userServerId={policyItem.id}
          mcpSlug={policyItem.mcpSlug}
          mcpName={policyItem.mcpName}
        />
      )}
    </Card>
  );
}
