"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-medium md:text-3xl">You already have a server.</h2>
          <p className="mt-2 text-base text-muted-foreground">
            We&apos;ll continue the rest of the onboarding with{" "}
            <span className="font-mono text-foreground">{existingServer.name}</span>.
          </p>
        </div>
        {/* One ledger line: hairline icon square, mono name, status badge (DESIGN.md §4.5, §4.9). */}
        <div className="flex items-center gap-4 border border-border bg-secondary/40 p-4">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center border border-border bg-card text-muted-foreground"
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
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "provisioning" || phase === "stuck") {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-medium md:text-3xl">
            {phase === "stuck" ? "Still provisioning…" : "Spinning up your runtime…"}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {phase === "stuck"
              ? "Upstash Box is taking longer than usual. You can move on — your server will keep provisioning in the background."
              : "Allocating an isolated micro-VM, installing TwinMCP Docs MCP, and assigning your endpoint. This usually takes ~10 seconds."}
          </p>
        </div>

        {/* Typewriter status line; the ochre tint once it is overdue. */}
        <div
          className={
            phase === "stuck"
              ? "flex items-center gap-3 border border-warning/40 bg-warning/10 px-4 py-3 font-mono text-xs text-warning"
              : "flex items-center gap-3 border border-border bg-secondary/60 px-4 py-3 font-mono text-xs text-muted-foreground"
          }
        >
          {phase === "provisioning" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>
            {phase === "provisioning" ? "status: provisioning" : "status: still provisioning"}
          </span>
        </div>

        {error && (
          <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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
        <h2 className="text-2xl font-medium md:text-3xl">Name your first server.</h2>
        <p className="mt-2 text-base text-muted-foreground">
          One free server. You can rename it later. Provisioning takes around 10 seconds.
        </p>
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
        <p className="text-xs italic text-muted-foreground">
          Used to derive a slug like <code className="font-mono not-italic">my-mcp</code>.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-6">
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
