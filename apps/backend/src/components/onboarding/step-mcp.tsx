"use client";

import { useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { badgeVariants } from "@/components/ui/badge";
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
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-medium md:text-3xl">No MCPs in the catalog yet.</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Skip ahead and install MCPs from the marketplace once it&apos;s seeded.
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-6">
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-medium md:text-3xl">Pick your first MCP.</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Browse the official catalog. You can install more from the marketplace anytime.
        </p>
      </div>

      {/* The catalogue card: a shade darker stock, hairline-square arrows either
          side, the MCP engraved dead-centre with its runtime and version in Courier. */}
      <div className="border border-border bg-secondary/40 p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous MCP"
            className="grid h-10 w-10 shrink-0 place-items-center border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 flex-col items-center text-center">
            <div className="grid h-10 w-10 place-items-center border border-border bg-card text-muted-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="smallcaps tracking-sc mt-4 text-lg font-medium">{current.name}</h3>
            <p className="mt-1.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>{current.runtime}</span>
              <span aria-hidden>·</span>
              <span>v{current.version}</span>
            </p>
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
            className="grid h-10 w-10 shrink-0 place-items-center border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Position in the catalogue: a row of short hairline ticks, the
            current one inked and doubled in weight. */}
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {catalog.map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-6 transition-colors",
                i === index ? "h-0.5 bg-foreground" : "h-px bg-border"
              )}
            />
          ))}
        </div>

        {propertyKeys.length > 0 && (
          <div className="mt-6 space-y-4 border-t border-border pt-5">
            <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
              Configuration
            </p>
            {propertyKeys.map((key) => {
              const def = properties[key];
              const value = config[key];
              return (
                <div key={key} className="flex flex-col gap-2 text-left">
                  <Label htmlFor={`mcp-${key}`} className="flex items-center gap-2">
                    <span className="no-smallcaps font-mono text-foreground">{key}</span>
                    {def.required && (
                      <span className={badgeVariants({ variant: "destructive" })}>required</span>
                    )}
                    {def.secret && (
                      <span className={badgeVariants({ variant: "outline" })}>secret</span>
                    )}
                  </Label>
                  {def.type === "boolean" ? (
                    <select
                      id={`mcp-${key}`}
                      value={String(value ?? false)}
                      onChange={(e) => update(key, e.target.value === "true")}
                      className="h-10 border border-input bg-card px-3 text-sm text-foreground shadow-inner focus-visible:border-foreground focus-visible:outline-none"
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
                    <p className="text-xs italic text-muted-foreground">{def.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-5 flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
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
