"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Copy, Key, Trash2 } from "lucide-react";
import type { Plan } from "@/db/schema/core";
import { limitFor, minPlanForLimit, PLAN_LABELS } from "@/lib/plan-features";

interface Key {
  id: string;
  prefix: string;
  name: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysPanel({ keys, plan }: { keys: Key[]; plan: Plan }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Key | null>(null);
  const [revoking, setRevoking] = useState(false);

  const limit = limitFor(plan, "apiKeys");
  const atLimit = keys.length >= limit;
  const upgradeTo = minPlanForLimit("apiKeys", keys.length + 1);

  async function createKey() {
    if (atLimit) return;
    setCreating(true);
    const res = await fetch("/api/v2/auth/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newKeyName || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setRevealedKey(data.key);
      setNewKeyName("");
      router.refresh();
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
      router.refresh();
      toast.success("Key revoked");
    } else {
      toast.error("Failed to revoke key");
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
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Use these to authenticate the TwinMCP server in your IDE or scripts.{" "}
          <span className="font-medium text-foreground">
            {keys.length}/{limit}
          </span>{" "}
          used on the {PLAN_LABELS[plan]} plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {revealedKey && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <p className="mb-2 font-medium text-emerald-700 dark:text-emerald-400">
              New key — copy now, it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded border border-border/80 bg-background px-2 py-1 font-mono text-xs">
                {revealedKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRevealedKey(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Key name (optional)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            disabled={atLimit}
          />
          <Button onClick={createKey} disabled={creating || atLimit}>
            {creating ? "Creating…" : "Create key"}
          </Button>
        </div>
        {atLimit && (
          <p className="text-xs text-muted-foreground">
            You&apos;ve reached your plan&apos;s limit of {limit} key{limit > 1 ? "s" : ""}.{" "}
            {upgradeTo && (
              <a href="/dashboard/billing" className="underline underline-offset-2">
                Upgrade to {PLAN_LABELS[upgradeTo]}
              </a>
            )}
            {upgradeTo ? " for more." : ""}
          </p>
        )}

        {keys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-center">
            <div
              aria-hidden
              className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground"
            >
              <Key className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium">No API keys yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Generate one above to authenticate the TwinMCP runtime in your IDE or scripts.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                    <TableCell>{k.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "never"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setRevokeTarget(k)}
                        aria-label={`Revoke key ${k.name ?? k.prefix}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke this API key?</DialogTitle>
              <DialogDescription>
                This immediately breaks any IDE or script using{" "}
                <code className="font-mono">{revokeTarget?.name ?? revokeTarget?.prefix}</code>. It
                can&apos;t be undone.
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
