"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
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
  configSchema: unknown;
}

export interface ServerOption {
  id: string;
  name: string;
  status: string;
}

interface SchemaField {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
  secret?: boolean;
}
interface ConfigSchema {
  properties: Record<string, SchemaField>;
}

function parseSchema(raw: unknown): ConfigSchema {
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

  useEffect(() => {
    if (mcp && userServers.length > 0) {
      setServerId(userServers[0].id);
      setConfig({});
    }
  }, [mcp, userServers]);

  if (!mcp) return null;
  const schema = parseSchema(mcp.configSchema);
  const fields = Object.entries(schema.properties);

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
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger id="server">
                <SelectValue placeholder="Pick a server" />
              </SelectTrigger>
              <SelectContent>
                {userServers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} <span className="text-muted-foreground text-xs ml-2">{s.status}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fields.length > 0 && (
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
                  <Input
                    id={key}
                    type={def.secret ? "password" : def.type === "number" ? "number" : "text"}
                    required={def.required}
                    value={config[key] ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                    placeholder={def.description ?? ""}
                  />
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
            <Button type="submit" disabled={submitting || !serverId}>
              {submitting ? "Installing…" : "Install"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
