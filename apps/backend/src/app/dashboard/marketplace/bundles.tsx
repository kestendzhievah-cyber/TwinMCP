"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { BUNDLES, type McpBundle } from "@/lib/mcp/bundles";
import type { CatalogEntry, ServerOption } from "./install-dialog";

interface ResolvedBundle {
  bundle: McpBundle;
  entries: CatalogEntry[];
}

export function McpBundles({
  catalog,
  userServers,
}: {
  catalog: CatalogEntry[];
  userServers: ServerOption[];
}) {
  const router = useRouter();

  // Resolve each bundle's slugs to real catalog entries; drop any slug not in
  // the catalog, and drop a bundle entirely if none of its MCPs are available.
  const bundles = useMemo<ResolvedBundle[]>(() => {
    const bySlug = new Map(catalog.map((c) => [c.slug, c]));
    return BUNDLES.map((bundle) => ({
      bundle,
      entries: bundle.slugs.map((s) => bySlug.get(s)).filter((e): e is CatalogEntry => Boolean(e)),
    })).filter((b) => b.entries.length > 0);
  }, [catalog]);

  // Starter bundles are cloud-box MCPs — only box servers can host them.
  const boxServers = useMemo(
    () => userServers.filter((s) => s.hostType === "upstash_box"),
    [userServers]
  );

  const [picking, setPicking] = useState<ResolvedBundle | null>(null);
  const [serverId, setServerId] = useState("");
  const [installing, setInstalling] = useState(false);

  if (bundles.length === 0) return null;

  function open(b: ResolvedBundle) {
    setServerId(boxServers[0]?.id ?? "");
    setPicking(b);
  }

  async function installBundle() {
    if (!picking || !serverId) return;
    setInstalling(true);
    let installed = 0;
    let already = 0;
    let failed = 0;
    let capacityHit = false;

    // Install sequentially so we respect the per-box capacity guard and can
    // report exactly what landed vs. what was already there or didn't fit.
    for (const entry of picking.entries) {
      try {
        const res = await fetch(`/api/v2/servers/${serverId}/mcps`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mcpServerId: entry.id, config: {} }),
        });
        if (res.ok) {
          installed++;
          continue;
        }
        const err = await res.json().catch(() => ({}));
        const msg = String(err.message ?? "").toLowerCase();
        if (msg.includes("already installed")) already++;
        else {
          failed++;
          if (res.status === 403 && msg.includes("box can run")) capacityHit = true;
        }
      } catch {
        failed++;
      }
    }

    setInstalling(false);
    const target = serverId;
    setPicking(null);

    if (installed > 0) {
      const parts = [`${installed} installed`];
      if (already) parts.push(`${already} already present`);
      if (failed) parts.push(`${failed} failed`);
      toast.success(`${picking.bundle.name}: ${parts.join(" · ")}`);
      router.push(`/dashboard/servers/${target}` as Route);
    } else if (already > 0 && failed === 0) {
      toast.info(`${picking.bundle.name}: everything was already installed.`);
    } else {
      toast.error(
        capacityHit
          ? "This box is full — remove an MCP or use a larger box, then retry."
          : "Couldn’t install the bundle. Try again."
      );
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Starter bundles</h2>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Install a curated set of MCPs in one click — zero setup, ready to use.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {bundles.map((b) => (
          <Card key={b.bundle.id} className="flex flex-col">
            <CardHeader className="flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <span aria-hidden>{b.bundle.emoji}</span>
                {b.bundle.name}
              </CardTitle>
              <CardDescription className="mt-1">{b.bundle.tagline}</CardDescription>
              <div className="mt-3 flex flex-wrap gap-1">
                {b.entries.map((e) => (
                  <Badge key={e.id} variant="secondary" className="text-xs">
                    {e.name}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                className="w-full"
                onClick={() => open(b)}
                disabled={boxServers.length === 0}
              >
                {boxServers.length === 0
                  ? "Needs a cloud-box server"
                  : `Install ${b.entries.length} MCPs`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!picking} onOpenChange={(o) => !o && !installing && setPicking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {picking?.bundle.emoji} Install the {picking?.bundle.name} bundle
            </DialogTitle>
            <DialogDescription>
              {picking?.entries.length} MCPs will be installed on your server, ready to use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-1">
              {picking?.entries.map((e) => (
                <Badge key={e.id} variant="secondary" className="text-xs">
                  {e.name}
                </Badge>
              ))}
            </div>

            {boxServers.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Target server</label>
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a server" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxServers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        <span className="ml-2 text-xs text-muted-foreground">{s.status}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPicking(null)} disabled={installing}>
              Cancel
            </Button>
            <Button onClick={installBundle} disabled={installing || !serverId}>
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Installing…
                </>
              ) : (
                `Install ${picking?.entries.length ?? ""} MCPs`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
