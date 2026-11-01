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
import type { Plan } from "@/db/schema/core";
import { BUNDLES, type McpBundle } from "@/lib/mcp/bundles";
import { isSmallBoxFull, toastBoxFull } from "@/components/billing/top-up-inline";
import { canUseMcpOnPromo } from "@/lib/wallet/eligibility";
import { Label } from "@/components/ui/label";
import { McpLogo } from "./mcp-logo";
import { LockedPill } from "./locked-pill";
import type { CatalogEntry, ServerOption } from "./install-dialog";

interface ResolvedBundle {
  bundle: McpBundle;
  entries: CatalogEntry[];
}

export function McpBundles({
  catalog,
  userServers,
  plan,
  promoOnly,
}: {
  catalog: CatalogEntry[];
  userServers: ServerOption[];
  /** The account's plan: "free" (never funded) gets the top-up toast when a small
   *  box is full, and skips the MCPs held back from the sign-up credit. */
  plan: Plan;
  /** Wallet never funded (computed server-side): the excluded MCPs are skipped. */
  promoOnly: boolean;
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

  // MCPs held back from the sign-up credit (lib/wallet/eligibility.ts): the
  // API refuses them (403) until the first top-up, so they are skipped.
  const isLocked = (e: CatalogEntry) =>
    promoOnly && !canUseMcpOnPromo(e.slug, { isOfficial: e.isOfficial });

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
    let locked = 0;
    let capacityHit = false;
    // The small box (the only size Free runs) is full: a plan limit for Free
    // accounts; paid plans get the server's own "use a larger box" message.
    let smallBoxFull = false;

    // Install sequentially so we respect the per-box capacity guard and can
    // report exactly what landed vs. what was already there or didn't fit.
    for (const entry of picking.entries) {
      if (isLocked(entry)) {
        locked++;
        continue;
      }
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
          if (res.status === 403 && msg.includes("box can run")) {
            capacityHit = true;
            if (isSmallBoxFull(msg)) smallBoxFull = true;
          }
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
      if (locked) parts.push(`${locked} need a top-up`);
      toast.success(`${picking.bundle.name}: ${parts.join(" · ")}`);
      router.push(`/dashboard/servers/${target}` as Route);
    } else if (already > 0 && failed === 0 && locked === 0) {
      toast.info(`${picking.bundle.name}: everything was already installed.`);
    } else if (locked > 0 && failed === 0) {
      toast.info(
        `${picking.bundle.name}: ${locked} MCP${locked > 1 ? "s" : ""} need a top-up; the rest was already installed.`
      );
    } else if (smallBoxFull && plan === "free") {
      toastBoxFull();
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
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Starter bundles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Install a curated set of MCPs in one click — zero setup, ready to use.
        </p>
      </div>

      {/* Bundle cards: a stack of the bundle's marks, the name and tagline,
          the contents as one muted line, then an outline action (the
          dialog holds the primary). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {bundles.map((b) => (
          <Card key={b.bundle.id} className="flex flex-col">
            <CardHeader className="flex-1 space-y-0">
              <div aria-hidden className="flex -space-x-2">
                {b.entries.map((e) => (
                  <span
                    key={e.id}
                    className="grid h-10 w-10 place-items-center rounded-full border-2 border-card bg-card shadow-sm ring-1 ring-border"
                  >
                    <McpLogo
                      slug={e.slug}
                      category={e.category}
                      size={22}
                      className="rounded-full"
                    />
                  </span>
                ))}
              </div>
              <CardTitle className="mt-4 text-base leading-snug">{b.bundle.name}</CardTitle>
              <CardDescription className="mt-1.5">{b.bundle.tagline}</CardDescription>
              <p className="mt-3 text-xs text-muted-foreground">
                {b.entries.map((e) => e.name).join(" · ")}
              </p>
            </CardHeader>
            <CardContent className="border-t border-border pt-4 sm:pt-4">
              <Button
                variant="outline"
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
            <DialogTitle>Install the {picking?.bundle.name} bundle</DialogTitle>
            <DialogDescription>
              <span className="tabular-nums">{picking?.entries.length}</span> MCPs will be installed
              on your server, ready to use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* The bundle's contents: mark, name, the lock pill if any, the mono slug. */}
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {picking?.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
                >
                  <McpLogo slug={e.slug} category={e.category} size={20} />
                  <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                  {isLocked(e) && <LockedPill />}
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{e.slug}</span>
                </li>
              ))}
            </ul>

            {boxServers.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="bundle-server">Target server</Label>
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger id="bundle-server">
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
