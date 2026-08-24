"use client";

import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface SchemaField {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
  secret?: boolean;
}

interface FetchedConfig {
  mcpName: string;
  mcpDescription: string;
  configSchema: { properties: Record<string, SchemaField> };
  config: Record<string, string | number | boolean | null>;
}

export function ReconfigureDialog({
  open,
  onOpenChange,
  serverId,
  userServerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  userServerId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<FetchedConfig | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/v2/servers/${serverId}/mcps/${userServerId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: FetchedConfig) => {
        if (cancelled) return;
        setData(d);
        const initial: Record<string, string> = {};
        for (const [k, def] of Object.entries(d.configSchema.properties ?? {})) {
          if (def.secret) {
            initial[k] = ""; // never prefill secrets
          } else {
            const v = d.config[k];
            initial[k] = v === null || v === undefined ? "" : String(v);
          }
        }
        setValues(initial);
      })
      .catch((err) => {
        toast.error(`Failed to load config: ${err.message}`);
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, serverId, userServerId, onOpenChange]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);

    const fields = Object.entries(data.configSchema.properties ?? {});
    const patch: Record<string, string | number | boolean> = {};
    for (const [k, def] of fields) {
      const raw = values[k];
      if (raw === undefined || raw === "") continue; // skip → keep existing
      if (def.type === "number") patch[k] = Number(raw);
      else if (def.type === "boolean") patch[k] = raw === "true";
      else patch[k] = raw;
    }

    const res = await fetch(`/api/v2/servers/${serverId}/mcps/${userServerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: patch }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Configuration updated");
      onOpenChange(false);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Failed to update");
    }
  }

  const fields = data ? Object.entries(data.configSchema.properties ?? {}) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {data?.mcpName ?? "MCP"}</DialogTitle>
          <DialogDescription>
            Update environment variables for this installation. Secret fields are kept unless you
            re-enter them.
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : fields.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            This MCP has no configuration options.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(([key, def]) => {
              const isSecret = !!def.secret;
              const hasExisting = data.config[key] !== undefined && data.config[key] !== null;
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>
                    {key}
                    {def.required && <span className="text-destructive ml-1">*</span>}
                    {isSecret && hasExisting && (
                      <span className="text-muted-foreground text-xs ml-2">
                        (currently set — leave empty to keep)
                      </span>
                    )}
                  </Label>
                  {def.type === "boolean" ? (
                    <Select
                      value={values[key] ?? ""}
                      onValueChange={(v) => setValues((vs) => ({ ...vs, [key]: v }))}
                    >
                      <SelectTrigger id={key}>
                        <SelectValue placeholder={hasExisting ? "Keep current" : "Select…"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={key}
                      type={isSecret ? "password" : def.type === "number" ? "number" : "text"}
                      value={values[key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      placeholder={isSecret && hasExisting ? "••••••••" : (def.description ?? "")}
                    />
                  )}
                  {def.description && !isSecret && (
                    <p className="text-xs text-muted-foreground">{def.description}</p>
                  )}
                </div>
              );
            })}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
