"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/format";
import { countsTowardKeyLimit, keyScopeLabel, type KeyScope } from "@/lib/auth/key-scope";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Copy, Key, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { Plan } from "@/db/schema/core";
import { limitFor, minPlanForLimit, PLAN_LABELS } from "@/lib/plan-features";
import { trialCta } from "@/lib/billing/upgrade-state";
import { UpgradeInline } from "@/components/billing/upgrade-inline";

interface Key {
  id: string;
  prefix: string;
  name: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  // From GET /api/v2/auth/keys (the server-rendered list predates scopes).
  scope?: KeyScope;
  serverId?: string | null;
  serverName?: string | null;
  expiresAt?: string | null;
  /** Agencies: their own id for the end customer the key was issued to. */
  externalUserId?: string | null;
}

interface ServerOption {
  id: string;
  name: string;
  status: string;
}

/** A replaced key in its 24 h rotation overlap: still works, frees its plan slot. */
function isRetiring(k: Key): boolean {
  return (
    !!k.expiresAt && !countsTowardKeyLimit({ revokedAt: null, expiresAt: new Date(k.expiresAt) })
  );
}

export function ApiKeysPanel({
  keys,
  plan,
  trialEligible = false,
}: {
  keys: Key[];
  plan: Plan;
  /** Free account with no Stripe customer yet: the upgrade link offers the free month. */
  trialEligible?: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  // The safe default: a key that can only call MCPs (on one server).
  const [newScope, setNewScope] = useState<KeyScope>("mcp_proxy");
  const [newServerId, setNewServerId] = useState<string>("");
  // Optional: an agency's own id for the end customer this proxy key is for.
  const [newExternalUserId, setNewExternalUserId] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedNote, setRevealedNote] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Key | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<Key | null>(null);
  const [rotating, setRotating] = useState(false);
  // Scope / server / expiry come from the keys API; the server-rendered `keys`
  // prop shows meanwhile (and if the fetch fails).
  const [liveKeys, setLiveKeys] = useState<Key[] | null>(null);
  const [serverOptions, setServerOptions] = useState<ServerOption[]>([]);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/auth/keys", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { keys?: Key[] };
      if (data.keys) setLiveKeys(data.keys);
    } catch {
      /* keep the server-rendered list */
    }
  }, []);

  // Re-read whenever the server-rendered list changes (router.refresh()).
  useEffect(() => {
    void loadKeys();
  }, [loadKeys, keys]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v2/servers", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: ServerOption[] };
        if (cancelled) return;
        const live = (data.items ?? []).filter((s) => s.status !== "destroyed");
        setServerOptions(live);
        setNewServerId((cur) => cur || live[0]?.id || "");
      } catch {
        /* no server listed: a proxy key can still be unbound */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shownKeys = liveKeys ?? keys;
  const usedSlots = useMemo(() => shownKeys.filter((k) => !isRetiring(k)).length, [shownKeys]);
  const limit = limitFor(plan, "apiKeys");
  const atLimit = usedSlots >= limit;
  const upgradeTo = minPlanForLimit("apiKeys", usedSlots + 1);

  function refresh() {
    router.refresh();
    void loadKeys();
  }

  async function createKey() {
    if (atLimit) return;
    setCreating(true);
    const body =
      newScope === "full"
        ? { name: newKeyName || undefined, scope: "full" }
        : {
            name: newKeyName || undefined,
            scope: "mcp_proxy",
            serverId: newServerId || undefined,
            externalUserId: newExternalUserId.trim() || undefined,
          };
    const res = await fetch("/api/v2/auth/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setRevealedKey(data.key);
      setRevealedNote(
        `${keyScopeLabel({ scope: data.scope ?? newScope, serverName: data.serverName })}.`
      );
      setNewKeyName("");
      setNewExternalUserId("");
      setCreateOpen(false);
      refresh();
      toast.success("API key created");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Failed to create key");
    }
    setCreating(false);
  }

  async function revokeKey(id: string) {
    setRevoking(true);
    const res = await fetch(`/api/v2/auth/keys/${id}`, { method: "DELETE" });
    setRevoking(false);
    if (res.ok) {
      setRevokeTarget(null);
      refresh();
      toast.success("Key revoked");
    } else {
      toast.error("Failed to revoke key");
    }
  }

  // Rotation mints a replacement with the same name, scope and server; the
  // old key keeps working for 24 h and frees its slot meanwhile, so rotating
  // works even at the plan limit — the fix for a lost key.
  async function rotateKey(id: string) {
    setRotating(true);
    const res = await fetch(`/api/v2/auth/keys/${id}/rotate`, { method: "POST" });
    setRotating(false);
    if (res.ok) {
      const data = await res.json();
      setRotateTarget(null);
      setRevealedKey(data.key);
      setRevealedNote(
        data.oldKeyExpiresAt
          ? `The old key keeps working until ${formatDateTime(data.oldKeyExpiresAt)}, then stops.`
          : null
      );
      refresh();
      toast.success("Key rotated — the old key works for 24 more hours");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Failed to rotate key");
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — select the key and copy it manually.");
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Proxy keys go in IDE configs and can only call MCP servers; full-access keys also drive
          the management API from scripts.{" "}
          <span className="lining font-medium not-italic text-foreground">
            {usedSlots}/{limit}
          </span>{" "}
          used on the {PLAN_LABELS[plan]} plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {revealedKey && (
          // The freshly minted key: a green-tinted memo slip with the key set
          // typewriter-style and a hairline-square copy button (DESIGN.md §4.6).
          <div className="border border-success/40 bg-success/10 p-3 text-sm">
            <p className="mb-2 flex items-center gap-2 font-medium text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              New key — copy now, it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all border border-border bg-card px-2 py-1.5 font-mono text-xs">
                {revealedKey}
              </code>
              <Button
                size="icon"
                variant="outline"
                className="shrink-0 border-border bg-card"
                onClick={copyKey}
                aria-label="Copy key"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRevealedKey(null);
                  setRevealedNote(null);
                }}
              >
                Dismiss
              </Button>
            </div>
            {revealedNote && <p className="mt-2 text-xs italic text-success">{revealedNote}</p>}
          </div>
        )}

        <div className="flex">
          <Button onClick={() => setCreateOpen(true)} disabled={atLimit}>
            <Plus className="h-4 w-4" />
            Create key
          </Button>
        </div>
        {atLimit &&
          (upgradeTo ? (
            // A plan limit with a plan that lifts it: the tinted memo line, trial-aware.
            <UpgradeInline
              source="keys"
              level="offer"
              reason="keys_limit"
              label={trialCta(trialEligible).label}
              description={`${PLAN_LABELS[plan]} includes ${limit} API key${limit > 1 ? "s" : ""}. ${PLAN_LABELS[upgradeTo]} gives you ${limitFor(upgradeTo, "apiKeys")}.`}
              className="lining"
            />
          ) : (
            <p className="text-xs italic text-muted-foreground">
              You&apos;ve reached your plan&apos;s limit of <span className="lining">{limit}</span>{" "}
              key{limit > 1 ? "s" : ""}. Rotate a key to replace one without using a slot.
            </p>
          ))}

        {shownKeys.length === 0 ? (
          // Empty state (DESIGN.md §5): dashed ink hairline, bare icon, small-caps title, italic body.
          <div className="flex flex-col items-center gap-2 border border-dashed border-foreground/40 bg-transparent px-6 py-10 text-center">
            <Key aria-hidden className="h-6 w-6 text-muted-foreground" />
            <p className="smallcaps tracking-sc mt-1 font-medium">No API keys yet</p>
            <p className="max-w-sm text-sm italic text-muted-foreground">
              Create one above to connect the TwinMCP runtime from your IDE. Lost a key later?
              Rotate it instead of revoking: you get a replacement without using a slot.
            </p>
          </div>
        ) : (
          // The ledger (DESIGN.md §4.5): mono prefixes, lining dates, a bare bin at the end.
          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>End customer</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                    <TableCell className="font-medium">{k.name ?? "—"}</TableCell>
                    <TableCell>
                      {k.scope ? (
                        <Badge variant={k.scope === "full" ? "warning" : "secondary"}>
                          {keyScopeLabel({ scope: k.scope, serverName: k.serverName })}
                        </Badge>
                      ) : (
                        <span className="italic text-muted-foreground">…</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[12rem] text-muted-foreground">
                      {k.externalUserId ? (
                        <span className="block truncate font-mono text-xs" title={k.externalUserId}>
                          {k.externalUserId}
                        </span>
                      ) : (
                        <span className="italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.lastUsedAt ? (
                        formatDate(k.lastUsedAt)
                      ) : (
                        <span className="italic">never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.expiresAt ? (
                        <span className="lining" title="Replaced by a rotation; stops working then">
                          {formatDateTime(k.expiresAt)}
                        </span>
                      ) : (
                        <span className="italic">never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(k.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRotateTarget(k)}
                          disabled={isRetiring(k)}
                          aria-label={`Rotate key ${k.name ?? k.prefix}`}
                          title={
                            isRetiring(k)
                              ? "Already replaced: rotate its replacement instead"
                              : "Rotate: mint a replacement; this key keeps working for 24 h"
                          }
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRevokeTarget(k)}
                          aria-label={`Revoke key ${k.name ?? k.prefix}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>
                The key is shown once. Pick the narrowest access that does the job.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-key-name">Name (optional)</Label>
                <Input
                  id="new-key-name"
                  placeholder="e.g. Laptop · Cursor"
                  maxLength={80}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <fieldset className="space-y-3">
                <legend className="smallcaps tracking-sc mb-2 text-xs font-medium text-foreground/85">
                  Access
                </legend>
                <label className="flex cursor-pointer items-start gap-3 border border-border p-3 has-[:checked]:border-foreground">
                  <input
                    type="radio"
                    name="key-scope"
                    value="mcp_proxy"
                    checked={newScope === "mcp_proxy"}
                    onChange={() => setNewScope("mcp_proxy")}
                    className="mt-1 accent-foreground"
                  />
                  <span className="space-y-1 text-sm">
                    <span className="block font-medium">MCP proxy only</span>
                    <span className="block italic text-muted-foreground">
                      Calls MCP servers, nothing else. The one to paste into an IDE config.
                    </span>
                  </span>
                </label>
                {newScope === "mcp_proxy" && (
                  <div className="flex flex-col gap-2 pl-7">
                    <Label htmlFor="new-key-server">Server</Label>
                    <select
                      id="new-key-server"
                      value={newServerId}
                      onChange={(e) => setNewServerId(e.target.value)}
                      className="h-10 w-full border border-input bg-card px-3 text-sm text-foreground shadow-inner transition-colors focus-visible:border-foreground focus-visible:outline-none [&>option]:bg-card [&>option]:text-foreground"
                    >
                      {serverOptions.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name}
                        </option>
                      ))}
                      <option value="">All my servers</option>
                    </select>
                    <Label htmlFor="new-key-external" className="mt-2">
                      End customer id (optional)
                    </Label>
                    <Input
                      id="new-key-external"
                      placeholder="e.g. acme-corp or your CRM id"
                      maxLength={128}
                      value={newExternalUserId}
                      onChange={(e) => setNewExternalUserId(e.target.value)}
                    />
                    <p className="text-xs italic text-muted-foreground">
                      For agencies: give each customer its own key, tagged with your id for them, so
                      you can tell keys apart and revoke one without the others.
                    </p>
                  </div>
                )}
                <label className="flex cursor-pointer items-start gap-3 border border-border p-3 has-[:checked]:border-foreground">
                  <input
                    type="radio"
                    name="key-scope"
                    value="full"
                    checked={newScope === "full"}
                    onChange={() => setNewScope("full")}
                    className="mt-1 accent-foreground"
                  />
                  <span className="space-y-1 text-sm">
                    <span className="block font-medium">Full access (management API)</span>
                    <span className="block italic text-muted-foreground">
                      Also creates and deletes servers and manages keys, like your login.
                    </span>
                  </span>
                </label>
                {newScope === "full" && (
                  <p className="flex items-start gap-2 border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Anyone holding this key controls your account: keep it out of IDE configs.
                  </p>
                )}
              </fieldset>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createKey} disabled={creating || atLimit}>
                {creating ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!rotateTarget} onOpenChange={(o) => !o && setRotateTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rotate this API key?</DialogTitle>
              <DialogDescription>
                A new key with the same access replaces{" "}
                <code className="font-mono text-xs not-italic text-foreground">
                  {rotateTarget?.name ?? rotateTarget?.prefix}
                </code>
                . The old key keeps working for 24 hours, then stops — revoke it instead if it
                leaked. You&apos;ll see the new key once: paste it into every IDE or script that
                used the old one.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRotateTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => rotateTarget && rotateKey(rotateTarget.id)}
                disabled={rotating}
              >
                {rotating ? "Rotating…" : "Rotate key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke this API key?</DialogTitle>
              <DialogDescription>
                This immediately breaks any IDE or script using{" "}
                <code className="font-mono text-xs not-italic text-foreground">
                  {revokeTarget?.name ?? revokeTarget?.prefix}
                </code>
                . It can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => revokeTarget && revokeKey(revokeTarget.id)}
                disabled={revoking}
              >
                {revoking ? "Revoking…" : "Revoke key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
