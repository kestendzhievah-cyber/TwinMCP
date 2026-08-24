"use client";

import { useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CatalogMcp {
  id: string;
  slug: string;
  name: string;
  description: string;
  runtime: string;
  version: string;
  configSchema: {
    properties?: Record<
      string,
      {
        type: "string" | "number" | "boolean";
        required?: boolean;
        description?: string;
        secret?: boolean;
      }
    >;
  };
}

interface StepMcpProps {
  catalog: CatalogMcp[];
  serverId: string;
  onInstalled: (mcpSlug: string) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepMcp({ catalog, serverId, onInstalled, onSkip, onBack }: StepMcpProps) {
  const [index, setIndex] = useState(0);
  const [config, setConfig] = useState<Record<string, string | number | boolean>>({});
  const [error, setError] = useState("");
  const [installing, setInstalling] = useState(false);

  if (catalog.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">No MCPs in the catalog yet.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Skip ahead and install MCPs from the marketplace once it&apos;s seeded.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button size="lg" onClick={onSkip}>
            Skip — connect IDE
          </Button>
        </div>
      </div>
    );
  }

  const current = catalog[index];
  const properties = current.configSchema.properties ?? {};
  const propertyKeys = Object.keys(properties);

  function update(field: string, value: string | number | boolean) {
    setConfig((c) => ({ ...c, [field]: value }));
  }

  function move(delta: number) {
    setIndex((i) => (i + delta + catalog.length) % catalog.length);
    setConfig({});
    setError("");
  }

  async function install() {
    setError("");
    setInstalling(true);
    try {
      const res = await fetch(`/api/v2/servers/${serverId}/mcps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mcpServerId: current.id, config }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "Install failed");
        setInstalling(false);
        return;
      }
      onInstalled(current.slug);
    } catch (err) {
      console.error("[onboarding install mcp]", err);
      setError("Network error — try again.");
      setInstalling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pick your first MCP.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse the official catalog. You can install more from the marketplace anytime.
        </p>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous MCP"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-foreground/80">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="mt-3 font-semibold tracking-tight">{current.name}</h3>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {current.runtime}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                v{current.version}
              </Badge>
            </div>
            <p className="mt-3 max-w-md text-balance text-sm text-muted-foreground">
              {current.description}
            </p>
            <p className="sr-only" aria-live="polite">
              MCP {index + 1} of {catalog.length}: {current.name}
            </p>
          </div>

          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next MCP"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {catalog.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === index ? "bg-foreground" : "bg-border"
              )}
            />
          ))}
        </div>

        {propertyKeys.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Configuration
            </p>
            {propertyKeys.map((key) => {
              const def = properties[key];
              const value = config[key];
              return (
                <div key={key} className="flex flex-col gap-1.5 text-left">
                  <Label htmlFor={`mcp-${key}`} className="flex items-center gap-2">
                    {key}
                    {def.required && (
                      <span className="text-[10px] font-normal text-destructive">required</span>
                    )}
                    {def.secret && (
                      <Badge variant="outline" className="text-[10px]">
                        secret
                      </Badge>
                    )}
                  </Label>
                  {def.type === "boolean" ? (
                    <select
                      id={`mcp-${key}`}
                      value={String(value ?? false)}
                      onChange={(e) => update(key, e.target.value === "true")}
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  ) : (
                    <Input
                      id={`mcp-${key}`}
                      type={def.secret ? "password" : def.type === "number" ? "number" : "text"}
                      value={(value ?? "") as string | number}
                      onChange={(e) => {
                        const v = def.type === "number" ? Number(e.target.value) : e.target.value;
                        update(key, v);
                      }}
                    />
                  )}
                  {def.description && (
                    <p className="text-xs text-muted-foreground">{def.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip} disabled={installing}>
            Skip — install later
          </Button>
          <Button size="lg" onClick={install} disabled={installing}>
            {installing ? "Installing…" : `Install ${current.name}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
