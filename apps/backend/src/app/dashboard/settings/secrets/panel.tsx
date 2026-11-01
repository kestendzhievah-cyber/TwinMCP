"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { isValidSecretName, normalizeSecretName, secretRef } from "@/lib/vault/refs";
import { usageLabel, type SecretUsage } from "@/lib/vault/usage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/dashboard/empty-state";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Secret {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  usedBy: SecretUsage[];
}

interface Missing {
  name: string;
  usedBy: SecretUsage[];
}

function UsedBy({ usedBy }: { usedBy: SecretUsage[] }) {
  if (usedBy.length === 0) return <span className="text-muted-foreground">unused</span>;
  return (
    <ul className="space-y-0.5">
      {usedBy.map((u) => (
        <li key={u.userServerId} className="text-sm">
          <Link
            href={`/dashboard/servers/${u.serverId}` as Route}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            {usageLabel(u)}
          </Link>
          {!u.enabled && <span className="ml-1 text-xs text-muted-foreground">(off)</span>}
        </li>
      ))}
    </ul>
  );
}

export function SecretsPanel() {
  const [secrets, setSecrets] = useState<Secret[] | null>(null);
  const [missing, setMissing] = useState<Missing[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addValue, setAddValue] = useState("");
  const [adding, setAdding] = useState(false);

  const [editTarget, setEditTarget] = useState<Secret | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Secret | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/secrets", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { secrets: Secret[]; missing?: Missing[] };
      setSecrets(data.secrets);
      setMissing(data.missing ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd(name = "") {
    setAddName(name);
    setAddValue("");
    setAddOpen(true);
  }

  async function addSecret() {
    const name = normalizeSecretName(addName);
    if (!isValidSecretName(name)) {
      toast.error("Name: 1 to 64 characters, A-Z, 0-9 and _ only.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/v2/secrets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, value: addValue }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(err.message ?? "Could not save the secret");
        return;
      }
      setAddOpen(false);
      setAddValue("");
      toast.success(`${name} saved`);
      void load();
    } finally {
      setAdding(false);
    }
  }

  async function updateSecret() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/secrets/${editTarget.name}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: editValue }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(err.message ?? "Could not update the secret");
        return;
      }
      const data = (await res.json()) as { reconfigured?: number };
      const n = data.reconfigured ?? 0;
      toast.success(
        n > 0
          ? `${editTarget.name} updated. ${n} MCP${n > 1 ? "s" : ""} restarting with the new value.`
          : `${editTarget.name} updated`
      );
      setEditTarget(null);
      setEditValue("");
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteSecret() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const force = deleteTarget.usedBy.length > 0 ? "?force=1" : "";
      const res = await fetch(`/api/v2/secrets/${deleteTarget.name}${force}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(err.message ?? "Could not delete the secret");
        return;
      }
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      void load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Page header: title, one line, and the page's single primary action. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">Secrets</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Save an API token once and use it in any MCP config as{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs text-foreground">
              {secretRef("NAME")}
            </code>
            . Values are stored encrypted, never shown again, and filled in when the MCP starts.
          </p>
        </div>
        <Button onClick={() => openAdd()} className="w-full shrink-0 sm:w-auto">
          <Plus aria-hidden />
          Add secret
        </Button>
      </header>

      {missing.length > 0 && (
        <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
            Referenced but not saved: these MCPs will not start until you add them.
          </p>
          <ul className="space-y-1">
            {missing.map((m) => (
              <li key={m.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <code className="font-mono text-xs">{m.name || "(empty name)"}</code>
                <span className="text-xs">{m.usedBy.map(usageLabel).join(", ")}</span>
                {isValidSecretName(m.name) && (
                  <Button size="sm" variant="outline" onClick={() => openAdd(m.name)}>
                    Add
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadError && !secrets ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Could not load your secrets. Refresh the page to try again.
        </p>
      ) : secrets === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : secrets.length === 0 ? (
        // Empty state: the header's "Add secret" stays the one primary action.
        <EmptyState
          icon={KeyRound}
          title="No secrets yet"
          description={
            <>
              Add a token here, then pick it with &ldquo;Use saved secret&rdquo; when you install or
              configure an MCP. Rotate it in one place for every MCP that uses it.
            </>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Used by</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.name}</TableCell>
                <TableCell>
                  <UsedBy usedBy={s.usedBy} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.lastUsedAt ? formatDateTime(s.lastUsedAt) : "never"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(s.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditValue("");
                        setEditTarget(s);
                      }}
                      aria-label={`Update the value of ${s.name}`}
                      title="Update value"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(s)}
                      aria-label={`Delete ${s.name}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a secret</DialogTitle>
            <DialogDescription>
              The value is encrypted and never shown again. Reference it in an MCP config as{" "}
              <code className="font-mono text-xs text-foreground">
                {secretRef(normalizeSecretName(addName) || "NAME")}
              </code>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="secret-name">Name</Label>
              <Input
                id="secret-name"
                className="font-mono"
                placeholder="GITHUB_TOKEN"
                maxLength={64}
                autoComplete="off"
                value={addName}
                onChange={(e) => setAddName(normalizeSecretName(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Capital letters, digits and underscores, up to 64 characters.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="secret-value">Value</Label>
              <Input
                id="secret-value"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addSecret} disabled={adding || !addName || !addValue}>
              {adding ? "Saving…" : "Save secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {editTarget?.name}</DialogTitle>
            <DialogDescription>
              {editTarget && editTarget.usedBy.some((u) => u.enabled)
                ? "Every enabled MCP that uses it restarts with the new value (on a stopped server, at its next start)."
                : "No enabled MCP uses it yet: the new value applies the next time one does."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="secret-new-value">New value</Label>
            <Input
              id="secret-new-value"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={updateSecret} disabled={saving || !editValue}>
              {saving ? "Saving…" : "Update value"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.usedBy.length > 0
                ? "These MCPs reference it. They keep running with the current value until their next restart, then will not start until you add it again or change their config."
                : "No MCP references it. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && deleteTarget.usedBy.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <UsedBy usedBy={deleteTarget.usedBy} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSecret} disabled={deleting}>
              {deleting
                ? "Deleting…"
                : deleteTarget && deleteTarget.usedBy.length > 0
                  ? "Delete anyway"
                  : "Delete secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
