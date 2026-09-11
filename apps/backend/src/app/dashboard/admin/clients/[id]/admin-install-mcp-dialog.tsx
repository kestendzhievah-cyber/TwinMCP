"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ConfigProp {
  type?: string;
  required?: boolean;
  description?: string;
  secret?: boolean;
}
interface CatalogMcp {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string | null;
  hostMode: string;
  runtime: string;
  configSchema: { properties?: Record<string, ConfigProp> } | null;
}

export function AdminInstallMcpDialog({
  clientId,
  serverId,
  open,
  onOpenChange,
  onDone,
}: {
  clientId: string;
  serverId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogMcp[]>([]);
  const [loading, setLoading] = useState(false);
  const [mcpId, setMcpId] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v2/admin/catalog", { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as { items: CatalogMcp[] };
        // Admin provisions cloud boxes → only box-hosted MCPs are installable here.
        setCatalog(d.items.filter((m) => m.hostMode === "box"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMcpId("");
      setConfig({});
      void load();
    }
  }, [open, load]);

  const selected = useMemo(() => catalog.find((m) => m.id === mcpId) ?? null, [catalog, mcpId]);
  const props = useMemo<[string, ConfigProp][]>(() => {
    const p = selected?.configSchema?.properties;
    return p ? Object.entries(p) : [];
  }, [selected]);

  async function submit() {
    if (!serverId || !mcpId) return;
    for (const [key, def] of props) {
      if (def.required && !config[key]?.trim()) {
        toast.error(`Champ requis : ${key}`);
        return;
      }
    }
    setSaving(true);
    try {
      const cleanConfig: Record<string, string> = {};
      for (const [key] of props) {
        const v = config[key]?.trim();
        if (v) cleanConfig[key] = v;
      }
      const res = await fetch(`/api/v2/admin/clients/${clientId}/servers/${serverId}/mcps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mcpServerId: mcpId, config: cleanConfig }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(e.message);
      }
      toast.success("MCP installé.");
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Échec de l'installation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Installer un MCP</DialogTitle>
          <DialogDescription>
            Choisissez un connecteur du catalogue à installer sur ce serveur (au nom du client).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label>Connecteur</Label>
            <Select value={mcpId} onValueChange={setMcpId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Chargement…" : "Choisir un MCP"} />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.category ? ` · ${m.category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.description && (
              <p className="text-xs text-muted-foreground">{selected.description}</p>
            )}
          </div>

          {props.length > 0 && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Configuration</p>
              {props.map(([key, def]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label>
                    {key}
                    {def.required ? " *" : ""}
                  </Label>
                  <Input
                    type={def.secret ? "password" : "text"}
                    value={config[key] ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                    placeholder={def.description ?? ""}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !mcpId}>
            {saving ? "Installation…" : "Installer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
