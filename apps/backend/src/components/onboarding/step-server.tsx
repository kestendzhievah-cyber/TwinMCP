"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, Check, Loader2, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { walletFacts } from "@/components/pricing/wallet-copy";

// The small box's MCP allowance, from the plan rules (lib/plan-features.ts).
const W = walletFacts("en");

const PROVISIONING_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_500;

type Phase = "form" | "provisioning" | "ready" | "stuck";

interface StepServerProps {
  existingServer: { id: string; name: string; slug: string; endpointUrl: string | null } | null;
  onReady: (server: { id: string; name: string; slug: string; endpointUrl: string | null }) => void;
  onBack: () => void;
}

export function StepServer({ existingServer, onReady, onBack }: StepServerProps) {
  const [name, setName] = useState("my-mcp");
  const [phase, setPhase] = useState<Phase>(existingServer ? "ready" : "form");
  const [error, setError] = useState("");
  const [serverId, setServerId] = useState<string | null>(existingServer?.id ?? null);
  const [serverSlug, setServerSlug] = useState<string | null>(existingServer?.slug ?? null);

  // Polling for provisioning status.
  useEffect(() => {
    if (phase !== "provisioning" || !serverId) return;

    const start = Date.now();
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/v2/servers/${serverId}/health`);
        if (!res.ok) throw new Error("health failed");
        const data = (await res.json()) as { status: string; endpointUrl: string | null };
        if (cancelled) return;

        if (data.status === "running") {
          setPhase("ready");
          onReady({ id: serverId!, name, slug: serverSlug ?? "", endpointUrl: data.endpointUrl });
          return;
        }
        if (data.status === "error") {
          setPhase("stuck");
          setError("Provisioning errored. You can retry or skip ahead.");
          return;
        }

        if (Date.now() - start > PROVISIONING_TIMEOUT_MS) {
          // Still provisioning after 30s — Upstash Box can be slow, allow user to proceed.
          setPhase("stuck");
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        console.error("[onboarding poll]", err);
        if (Date.now() - start > PROVISIONING_TIMEOUT_MS) {
          setPhase("stuck");
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [phase, serverId, serverSlug, name, onReady]);

  async function handleCreate() {
    setError("");
    setPhase("provisioning");
    try {
      const res = await fetch("/api/v2/servers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "Failed to create server");
        setPhase("form");
        return;
      }
      const data = (await res.json()) as { id: string; slug: string };
      setServerId(data.id);
      setServerSlug(data.slug);
    } catch (err) {
      console.error("[onboarding create server]", err);
      setError("Network error — check your connection and retry.");
      setPhase("form");
    }
  }

  if (phase === "ready" && existingServer) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            You already have a server.
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            We&apos;ll continue the rest of the onboarding with{" "}
            <span className="font-mono text-foreground">{existingServer.name}</span>.
          </p>
        </div>
        {/* The server as one row: icon, mono name, status badge. */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-alt p-4">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card text-brand shadow-sm"
          >
            <Server className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
            {existingServer.name}
          </span>
          <Badge variant="success">running</Badge>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-6">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button size="lg" onClick={() => onReady(existingServer)}>
            Continue
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "provisioning" || phase === "stuck") {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {phase === "stuck" ? "Still provisioning…" : "Spinning up your runtime…"}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {phase === "stuck"
              ? "Upstash Box is taking longer than usual. You can move on — your server will keep provisioning in the background."
              : "Allocating an isolated micro-VM, installing the TwinMCP Docs MCP and assigning your endpoint. This takes about 15 seconds."}
          </p>
        </div>

        {/* Status line in mono; the warning tint once it is overdue. */}
        <div
          role="status"
          className={
            phase === "stuck"
              ? "flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 font-mono text-xs text-warning"
              : "flex items-center gap-3 rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-xs text-muted-foreground"
          }
        >
          {phase === "provisioning" ? (
            <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-brand" />
          ) : (
            <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
          )}
          <span>
            {phase === "provisioning" ? "status: provisioning" : "status: still provisioning"}
          </span>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {serverId && (
          <div className="flex justify-end border-t border-border pt-6">
            <Button
              size="lg"
              className="h-auto min-h-12 whitespace-normal py-2 text-center"
              variant={phase === "stuck" ? "default" : "ghost"}
              onClick={() =>
                onReady({ id: serverId, name, slug: serverSlug ?? "", endpointUrl: null })
              }
            >
              {phase === "stuck" ? "Continue anyway" : "Continue in the background"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Name your first server.
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          One free server. You can rename it later. Provisioning takes about 15 seconds; each MCP
          you add then installs in about a minute.
        </p>
      </div>

      {/* The box size: small, the size every new server starts on. Shown as
          the selected option; larger boxes come with a funded account. */}
      <div>
        <p className="mb-2 text-sm font-medium">Box size</p>
        <div className="flex items-center gap-3 rounded-xl border border-brand bg-brand/5 p-4 ring-1 ring-brand">
          <span
            aria-hidden
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Small</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Runs up to {W.smallMcps} MCPs at once. Medium and large boxes are available on a
              funded account.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="server-name">Server name</Label>
        <Input
          id="server-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-mcp"
          maxLength={80}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Used to derive a slug like <code className="font-mono">my-mcp</code>.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={handleCreate} disabled={!name.trim()}>
          Create server
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
