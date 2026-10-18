"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
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
import { CheckCircle2, Copy, Key, Trash2 } from "lucide-react";
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
      <CardHeader className="border-b border-border">
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Use these to authenticate the TwinMCP server in your IDE or scripts.{" "}
          <span className="lining font-medium not-italic text-foreground">
            {keys.length}/{limit}
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
              <Button variant="ghost" onClick={() => setRevealedKey(null)}>
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
          <p className="text-xs italic text-muted-foreground">
            You&apos;ve reached your plan&apos;s limit of <span className="lining">{limit}</span>{" "}
            key{limit > 1 ? "s" : ""}.{" "}
            {upgradeTo && (
              <a
                href="/dashboard/billing"
                className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
              >
                Upgrade to {PLAN_LABELS[upgradeTo]}
              </a>
            )}
            {upgradeTo ? " for more." : ""}
          </p>
        )}

        {keys.length === 0 ? (
          // Empty state (DESIGN.md §5): dashed ink hairline, bare icon, small-caps title, italic body.
          <div className="flex flex-col items-center gap-2 border border-dashed border-foreground/40 bg-transparent px-6 py-10 text-center">
            <Key aria-hidden className="h-6 w-6 text-muted-foreground" />
            <p className="smallcaps tracking-sc mt-1 font-medium">No API keys yet</p>
            <p className="max-w-sm text-sm italic text-muted-foreground">
              Generate one above to authenticate the TwinMCP runtime in your IDE or scripts.
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
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                    <TableCell className="font-medium">{k.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.lastUsedAt ? (
                        formatDate(k.lastUsedAt)
                      ) : (
                        <span className="italic">never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(k.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
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
