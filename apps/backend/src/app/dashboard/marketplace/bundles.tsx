"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";
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
    <section className="space-y-4">
      {/* Section head: the small-capital title running into a hairline, one
          italic line beneath — the same voice as "All MCPs" below. */}
      <div>
        <h2 className="smallcaps tracking-sc flex items-center gap-4 text-xl font-medium after:h-px after:flex-1 after:bg-border after:content-['']">
          Starter bundles
        </h2>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Install a curated set of MCPs in one click — zero setup, ready to use.
        </p>
      </div>

      {/* Bundle cards: bone stock, one hairline, the contents set as a small
          ledger (one hairline row per MCP), the action under a rule. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {bundles.map((b) => (
          <Card key={b.bundle.id} className="flex flex-col">
            <CardHeader className="flex-1 space-y-0">
              <CardTitle className="text-base leading-snug">{b.bundle.name}</CardTitle>
              <CardDescription className="mt-2">{b.bundle.tagline}</CardDescription>
              <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
                {b.entries.map((e) => (
                  <li key={e.id} className="py-1.5">
                    {e.name}
                  </li>
                ))}
              </ul>
            </CardHeader>
            <CardContent className="border-t border-border px-6 py-4">
              <Button
                className="lining w-full"
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
            <DialogTitle>Install the {picking?.bundle.name} bundle</DialogTitle>
            <DialogDescription>
              <span className="lining">{picking?.entries.length}</span> MCPs will be installed on
              your server, ready to use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* The bundle's contents as a ledger: name, then the mono slug. */}
            <ul className="divide-y divide-border border border-border bg-secondary/40">
              {picking?.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-baseline justify-between gap-4 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{e.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{e.slug}</span>
                </li>
              ))}
            </ul>

            {boxServers.length > 1 && (
              <div className="space-y-2">
                <label className="smallcaps tracking-sc text-xs font-medium text-foreground/85">
                  Target server
                </label>
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a server" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxServers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        <span className="smallcaps tracking-sc ml-2 text-xs text-muted-foreground">
                          {s.status}
                        </span>
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
            <Button className="lining" onClick={installBundle} disabled={installing || !serverId}>
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
