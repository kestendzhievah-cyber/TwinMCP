"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">You already have a server.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ll continue the rest of the onboarding with{" "}
            <span className="font-mono text-foreground">{existingServer.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <Server className="h-4 w-4 text-emerald-500" />
          <span>
            <span className="font-medium text-foreground">{existingServer.name}</span>
            <span className="text-muted-foreground"> · running</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button size="lg" onClick={() => onReady(existingServer)}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "provisioning" || phase === "stuck") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {phase === "stuck" ? "Still provisioning…" : "Spinning up your runtime…"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {phase === "stuck"
              ? "Upstash Box is taking longer than usual. You can move on — your server will keep provisioning in the background."
              : "Allocating an isolated micro-VM, installing TwinMCP Docs MCP, and assigning your endpoint. This usually takes ~10 seconds."}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/40 p-4 text-sm">
          {phase === "provisioning" ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {phase === "provisioning" ? "status: provisioning" : "status: still provisioning"}
          </span>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {phase === "stuck" && serverId && (
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() =>
                onReady({ id: serverId, name, slug: serverSlug ?? "", endpointUrl: null })
              }
            >
              Continue anyway
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Name your first server.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One free server. You can rename it later. Provisioning takes around 10 seconds.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
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
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={handleCreate} disabled={!name.trim()}>
          Provision server
        </Button>
      </div>
    </div>
  );
}
