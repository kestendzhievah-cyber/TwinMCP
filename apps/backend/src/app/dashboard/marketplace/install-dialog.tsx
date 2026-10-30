"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useMcpConfigSchema } from "./use-config-schema";
import { cliCommand } from "@/lib/cli";
import type { Plan } from "@/db/schema/core";
import { isSmallBoxFull, toastBoxFull } from "@/components/billing/top-up-inline";
import { PROMO_LOCKED_MCP_MESSAGE } from "@/lib/wallet/eligibility";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecretField } from "@/components/vault/secret-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CatalogEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  runtime: string;
  version: string;
  isOfficial: boolean;
  hostMode: string;
  category: string | null;
  repoUrl: string | null;
  // Epoch ms (serialized from the DB timestamp) — used for the "newest" sort.
  createdAt: number;
}

export interface ServerOption {
  id: string;
  name: string;
  status: string;
  hostType: string;
}

export interface SchemaField {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
  secret?: boolean;
}
export interface ConfigSchema {
  properties: Record<string, SchemaField>;
}

export function parseSchema(raw: unknown): ConfigSchema {
  if (raw && typeof raw === "object" && "properties" in raw) {
    return raw as ConfigSchema;
  }
  return { properties: {} };
}

export function InstallDialog({
  mcp,
  userServers,
  plan,
  locked = false,
  onClose,
}: {
  mcp: CatalogEntry | null;
  userServers: ServerOption[];
  /** The account's tier: only Free credit gets the top-up toast when a small box is full. */
  plan: Plan;
  /** Free credit account and a compute-heavy MCP: installable after a first top-up. */
  locked?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [serverId, setServerId] = useState<string>("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Optional: install with a read-only tool policy (lib/mcp/tool-policy.ts).
  const [startReadOnly, setStartReadOnly] = useState(false);
  // Config schema loaded on demand + cached across opens.
  const { schema: rawSchema, loading: schemaLoading } = useMcpConfigSchema(mcp?.id ?? null);

  useEffect(() => {
    if (!mcp) return;
    const localTool = mcp.hostMode === "local";
    const compat = userServers.filter((s) => (s.hostType === "local_agent") === localTool);
    setServerId(compat[0]?.id ?? "");
    setConfig({});
    setStartReadOnly(false);
  }, [mcp, userServers]);

  if (!mcp) return null;
  const schema = parseSchema(rawSchema);
  const fields = Object.entries(schema.properties);
  // A tool's host mode must match the server: local tools only fit local-agent
  // servers; box tools only fit box servers (the API enforces this too).
  const isLocalTool = mcp.hostMode === "local";
  const compatible = userServers.filter((s) => (s.hostType === "local_agent") === isLocalTool);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mcp || !serverId) return;
    // SecretField has no native `required`: check required secrets here.
    const missingSecret = fields.find(([k, def]) => def.secret && def.required && !config[k]);
    if (missingSecret) {
      toast.error(`${missingSecret[0]} is required.`);
      return;
    }
    setSubmitting(true);

    const typedConfig: Record<string, string | number | boolean> = {};
    for (const [k, def] of fields) {
      const v = config[k];
      if (v === undefined || v === "") continue;
      if (def.type === "number") typedConfig[k] = Number(v);
      else if (def.type === "boolean") typedConfig[k] = v === "true";
      else typedConfig[k] = v;
    }

    const res = await fetch(`/api/v2/servers/${serverId}/mcps`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mcpServerId: mcp.id, config: typedConfig }),
    });
    let readOnlyApplied = false;
    if (res.ok && startReadOnly) {
      // The install itself succeeded; a failed policy write must not read as
      // a failed install, so it only warns.
      const created = (await res
        .clone()
        .json()
        .catch(() => ({}))) as { id?: unknown };
      readOnlyApplied =
        typeof created.id === "string" &&
        (await fetch(`/api/v2/servers/${serverId}/mcps/${created.id}/policy`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ policy: { mode: "read_only" } }),
        })
          .then((r) => r.ok)
          .catch(() => false));
      if (!readOnlyApplied) {
        toast.warning(
          "Installed, but read-only mode could not be set. Use Tool access on the server page."
        );
      }
    }
    setSubmitting(false);
    if (res.ok) {
      toast.success(`Installed ${mcp.name}${readOnlyApplied ? " (read-only)" : ""}`);
      onClose();
      router.push(`/dashboard/servers/${serverId}` as Route);
    } else {
      const err = await res.json().catch(() => ({}));
      // For a Free credit account a small box at its MCP cap is a tier limit,
      // not an error: point at the larger boxes a top-up unlocks. Paid
      // plans keep the server's own message, which already names the real cap
      // and suggests a larger box.
      if (plan === "free" && res.status === 403 && isSmallBoxFull(String(err.message ?? ""))) {
        toastBoxFull();
      } else toast.error(err.message ?? "Failed to install");
    }
  }

  return (
    <Dialog open={!!mcp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {mcp.name}</DialogTitle>
          <DialogDescription className="not-italic">{mcp.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {locked && (
            <p className="border border-warning/40 border-l-2 border-l-warning bg-warning/10 px-3 py-2 text-sm text-warning">
              {PROMO_LOCKED_MCP_MESSAGE}.{" "}
              <Link
                href={"/dashboard/billing" as Route}
                className="font-medium underline decoration-warning/40 underline-offset-4 hover:decoration-warning"
              >
                Top up
              </Link>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="server">Target server</Label>
            {compatible.length === 0 ? (
              <p className="border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
                {isLocalTool
                  ? "This tool runs locally — create a Local (agent) server first, then install it here."
                  : "Create a cloud-box server first to install this tool."}
              </p>
            ) : (
              <Select value={serverId} onValueChange={setServerId}>
                <SelectTrigger id="server">
                  <SelectValue placeholder="Pick a server" />
                </SelectTrigger>
                <SelectContent>
                  {compatible.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{" "}
                      <span className="smallcaps tracking-sc ml-2 text-xs text-muted-foreground">
                        {s.status}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isLocalTool && compatible.length > 0 && (
              <p className="text-xs italic text-muted-foreground">
                Runs on your machine via the TwinMCP local agent (
                <code className="font-mono not-italic">{cliCommand("connect")}</code>); the
                server&apos;s Connect panel has the exact command.
              </p>
            )}
          </div>

          {schemaLoading && (
            <p className="border-t border-border pt-4 text-xs italic text-muted-foreground">
              Loading configuration…
            </p>
          )}

          {!schemaLoading && fields.length > 0 && (
            // Configuration block: eyebrow with a leading rule, then one field
            // per key — the key in Courier, help in italic (DESIGN.md §5 forms).
            <div className="space-y-4 border-t border-border pt-4">
              <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                Configuration
              </p>
              {fields.map(([key, def]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key} className="flex items-center gap-1">
                    <span className="no-smallcaps font-mono text-foreground">{key}</span>
                    {def.required && <span className="text-destructive">*</span>}
                  </Label>
                  {def.type === "boolean" ? (
                    <Select
                      value={config[key] ?? "false"}
                      onValueChange={(v) => setConfig((c) => ({ ...c, [key]: v }))}
                    >
                      <SelectTrigger id={key}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : def.secret ? (
                    // Paste the value or pick a saved secret ({{secret:NAME}},
                    // resolved server-side at provisioning — contract D6).
                    <SecretField
                      id={key}
                      value={config[key] ?? ""}
                      onChange={(v) => setConfig((c) => ({ ...c, [key]: v }))}
                      suggestedName={key}
                      placeholder={def.description ?? ""}
                    />
                  ) : (
                    <Input
                      id={key}
                      type={def.type === "number" ? "number" : "text"}
                      required={def.required}
                      value={config[key] ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                      placeholder={def.description ?? ""}
                    />
                  )}
                  {def.description && (
                    <p className="text-xs italic text-muted-foreground">{def.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 border-t border-border pt-4 text-sm">
            <input
              type="checkbox"
              checked={startReadOnly}
              onChange={(e) => setStartReadOnly(e.target.checked)}
              className="mt-1 h-4 w-4 accent-foreground"
            />
            <span className="space-y-1">
              <span className="block font-medium">Start read-only</span>
              <span className="block text-xs italic text-muted-foreground">
                Expose only the tools the MCP marks read-only. Change it later under Tool access.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={locked || submitting || !serverId || schemaLoading}>
              {submitting ? "Installing…" : "Install"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
