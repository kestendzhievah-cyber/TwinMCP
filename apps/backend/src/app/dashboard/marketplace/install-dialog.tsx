"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useMcpConfigSchema } from "./use-config-schema";
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
  onClose,
}: {
  mcp: CatalogEntry | null;
  userServers: ServerOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [serverId, setServerId] = useState<string>("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Config schema loaded on demand + cached across opens.
  const { schema: rawSchema, loading: schemaLoading } = useMcpConfigSchema(mcp?.id ?? null);

  useEffect(() => {
    if (!mcp) return;
    const localTool = mcp.hostMode === "local";
    const compat = userServers.filter((s) => (s.hostType === "local_agent") === localTool);
    setServerId(compat[0]?.id ?? "");
    setConfig({});
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
    setSubmitting(false);
    if (res.ok) {
      toast.success(`Installed ${mcp.name}`);
      onClose();
      router.push(`/dashboard/servers/${serverId}` as Route);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Failed to install");
    }
  }

  return (
    <Dialog open={!!mcp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {mcp.name}</DialogTitle>
          <DialogDescription>{mcp.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server">Target server</Label>
            {compatible.length === 0 ? (
              <p className="text-xs text-muted-foreground">
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
                      <span className="text-muted-foreground text-xs ml-2">{s.status}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isLocalTool && compatible.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Runs on your machine via <code className="font-mono">ctx7 connect</code>.
              </p>
            )}
          </div>

          {schemaLoading && (
            <p className="border-t pt-3 text-xs text-muted-foreground">Loading configuration…</p>
          )}

          {!schemaLoading && fields.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Configuration
              </p>
              {fields.map(([key, def]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>
                    {key}
                    {def.required && <span className="text-destructive ml-1">*</span>}
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
                  ) : (
                    <Input
                      id={key}
                      type={def.secret ? "password" : def.type === "number" ? "number" : "text"}
                      required={def.required}
                      value={config[key] ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                      placeholder={def.description ?? ""}
                    />
                  )}
                  {def.description && (
                    <p className="text-xs text-muted-foreground">{def.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !serverId || schemaLoading}>
              {submitting ? "Installing…" : "Install"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
