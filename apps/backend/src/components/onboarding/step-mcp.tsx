"use client";

import { useState } from "react";
import { AlertCircle, Check, KeyRound, Lock, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, fieldClasses } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";
import { cn } from "@/lib/utils";

const TITLE = "font-display text-2xl font-bold tracking-tight sm:text-3xl";

export interface CatalogMcp {
  id: string;
  slug: string;
  name: string;
  description: string;
  runtime: string;
  version: string;
  /** "popular": a well-known app that needs the user's API key; "instant": zero-config. */
  group?: "popular" | "instant";
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
  // Open on the first no-key MCP so "Install" works in one click; the
  // well-known apps above it are one tap away for users who have a key.
  const [index, setIndex] = useState(() => {
    const firstInstant = catalog.findIndex((m) => m.group !== "popular");
    return firstInstant === -1 ? 0 : firstInstant;
  });
  const [config, setConfig] = useState<Record<string, string | number | boolean>>({});
  const [error, setError] = useState("");
  const [installing, setInstalling] = useState(false);

  if (catalog.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className={TITLE}>No MCPs in the catalogue yet.</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Skip ahead and install MCPs from the marketplace once it&apos;s seeded.
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-6">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button size="lg" onClick={onSkip}>
            Skip, connect your client
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

  function select(i: number) {
    if (i === index) return;
    setIndex(i);
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
        // Re-entering onboarding (?force=1) with this MCP already on the
        // server is not an error: carry on to Connect with it.
        if (data.message && /already installed/i.test(data.message)) {
          onInstalled(current.slug);
          return;
        }
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

  const indexed = catalog.map((mcp, i) => ({ mcp, i }));
  const groups = [
    {
      key: "popular",
      title: "Popular apps",
      hint: "Bring your own API key",
      Icon: KeyRound,
      items: indexed.filter(({ mcp }) => mcp.group === "popular"),
    },
    {
      key: "instant",
      title: "Try instantly",
      hint: "No API key needed",
      Icon: Zap,
      items: indexed.filter(({ mcp }) => mcp.group !== "popular"),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className={TITLE}>Pick your first MCP.</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Connect an app you already use with its API key, or try one instantly with no key at all.
          Installing takes about a minute; you can wire up your client meanwhile.
        </p>
      </div>

      {/* Two logo grids: well-known apps (need the user's API key), then
          zero-config MCPs; the chosen one is outlined in brand blue. One
          radiogroup per list, same selection state. */}
      {groups.map(({ key, title, hint, Icon, items }) =>
        items.length === 0 ? null : (
          <section key={key} className="space-y-3" aria-labelledby={`mcp-group-${key}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3
                id={`mcp-group-${key}`}
                className="flex items-center gap-2 text-base font-semibold"
              >
                <Icon aria-hidden className="h-4 w-4 text-brand" />
                {title}
              </h3>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <div
              role="radiogroup"
              aria-labelledby={`mcp-group-${key}`}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              {items.map(({ mcp, i }) => {
                const active = i === index;
                const locked = PROMO_EXCLUDED_MCP_SLUGS.includes(mcp.slug);
                return (
                  <button
                    key={mcp.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => select(i)}
                    className={cn(
                      "relative flex min-w-0 flex-col items-start gap-2 rounded-xl border bg-card p-3.5 text-left transition-[border-color,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4",
                      active
                        ? "border-brand bg-brand/5 ring-1 ring-brand"
                        : "border-border hover:border-input hover:shadow-md"
                    )}
                  >
                    {hasBrandLogo(mcp.slug) ? (
                      <BrandLogo slug={mcp.slug} size={32} decorative />
                    ) : (
                      <span
                        aria-hidden
                        className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-brand"
                      >
                        <Sparkles className="h-4 w-4" />
                      </span>
                    )}
                    <span className="pr-6 text-sm font-semibold">{mcp.name}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {mcp.description}
                    </span>
                    {mcp.group === "popular" && !locked && (
                      <Badge variant="outline" className="mt-auto max-w-full whitespace-normal">
                        <KeyRound aria-hidden className="h-3 w-3" />
                        Needs your API key
                      </Badge>
                    )}
                    {locked && (
                      <Badge variant="offer" className="mt-auto max-w-full whitespace-normal">
                        <Lock aria-hidden className="h-3 w-3" />
                        Unlocks with first top-up
                      </Badge>
                    )}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-foreground"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )
      )}

      <div className="rounded-xl border border-border bg-surface-alt p-4 sm:p-5">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold">{current.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {current.runtime} ·{" "}
            {/^\d/.test(current.version) ? `v${current.version}` : current.version}
          </span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
        <p className="sr-only" aria-live="polite">
          MCP {index + 1} of {catalog.length}: {current.name}
        </p>

        {propertyKeys.length > 0 && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <p className="eyebrow">Configuration</p>
            {propertyKeys.map((key) => {
              const def = properties[key];
              const value = config[key];
              return (
                <div key={key} className="flex flex-col gap-2 text-left">
                  <Label htmlFor={`mcp-${key}`} className="flex items-center gap-2">
                    <span className="font-mono text-foreground">{key}</span>
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
                      className={cn("h-10", fieldClasses)}
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
          <p className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onSkip} disabled={installing}>
            Skip, install later
          </Button>
          <Button
            size="lg"
            className="h-auto min-h-12 whitespace-normal py-2 text-center"
            onClick={install}
            disabled={installing}
          >
            {installing ? "Installing…" : `Install ${current.name}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
