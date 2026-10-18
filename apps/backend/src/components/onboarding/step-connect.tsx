"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import {
  API_KEY_PLACEHOLDER,
  buildClientConfig,
  proxyUrl,
  testMcpConnection,
} from "@/lib/mcp/client-config";
import { cn } from "@/lib/utils";
import type { IdePreference } from "./step-welcome";

interface StepConnectProps {
  serverId: string;
  serverName: string;
  serverSlug: string;
  mcpSlug: string;
  /** True when the user skipped installing an MCP and we default to twinmcp-docs. */
  isDocsDefault?: boolean;
  ide: IdePreference;
  onFinish: () => void;
  onBack: () => void;
}

type TestState = "idle" | "running" | "success" | "error";

export function StepConnect({
  serverName,
  serverSlug,
  mcpSlug,
  isDocsDefault = false,
  ide,
  onFinish,
  onBack,
}: StepConnectProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState("");
  const [test, setTest] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Auto-mint an API key on mount, once.
  useEffect(() => {
    let cancelled = false;
    async function mint() {
      try {
        const res = await fetch("/api/v2/auth/keys", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `${serverName} · onboarding` }),
        });
        if (!res.ok) throw new Error("key creation failed");
        const data = (await res.json()) as { key: string };
        if (!cancelled) setApiKey(data.key);
      } catch (err) {
        console.error("[onboarding mint key]", err);
        if (!cancelled) {
          setKeyError("Could not auto-create an API key. Generate one from /dashboard.");
        }
      }
    }
    void mint();
    return () => {
      cancelled = true;
    };
  }, [serverName]);

  const url = origin ? proxyUrl(origin, serverSlug, mcpSlug) : "";
  const cfg = useMemo(
    () => buildClientConfig(ide, { url, apiKey: apiKey ?? API_KEY_PLACEHOLDER, label: mcpSlug }),
    [ide, url, apiKey, mcpSlug]
  );

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function runTest() {
    if (!apiKey || !url) return;
    setTest("running");
    setTestMsg("");
    const result = await testMcpConnection(url, apiKey);
    setTest(result.ok ? "success" : "error");
    setTestMsg(result.message);
  }

  async function finish() {
    setFinishing(true);
    try {
      await fetch("/api/v2/users/me/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markCompleted: true }),
      });
    } catch (err) {
      console.error("[onboarding finish]", err);
    }
    onFinish();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-medium md:text-3xl">Connect your LLM.</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Drop this block into your client config. Your API key is shown once — copy it now, you can
          rotate it later from <code className="font-mono">/dashboard</code>.
        </p>
        <p className="mt-4 text-sm">
          <span className="smallcaps tracking-sc text-xs text-muted-foreground">Connecting to</span>{" "}
          <span className="font-medium">{serverName}</span> ·{" "}
          <code className="font-mono text-xs">{mcpSlug}</code>
        </p>
        {isDocsDefault && (
          <p className="mt-3 border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
            You skipped installing an MCP, so this connects the built-in{" "}
            <span className="font-medium">TwinMCP Docs</span> MCP. Add more anytime from the{" "}
            <span className="font-medium">Marketplace</span>.
          </p>
        )}
      </div>

      {keyError && (
        <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {keyError}
        </p>
      )}

      {/* Typewriter line: the endpoint in Courier on a shade darker stock, the
          copy button a hairline square (DESIGN.md §4.6). */}
      <div className="space-y-2">
        <p className="smallcaps tracking-sc text-xs font-medium text-muted-foreground">
          Connection URL
        </p>
        <div className="flex items-center gap-3 border border-border bg-secondary/60 py-1.5 pl-3 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">{url || "…"}</code>
          <button
            type="button"
            onClick={copyUrl}
            aria-label="Copy URL"
            className="grid h-10 w-10 shrink-0 place-items-center border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <CodeSnippet code={cfg.code} language={cfg.language} filename={cfg.filename} />

      <div className="border border-border bg-secondary/40 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="smallcaps tracking-sc text-sm font-medium">Test connection</p>
            <p className="mt-1 text-xs italic text-muted-foreground">
              Performs a real MCP <code className="font-mono not-italic">initialize</code>{" "}
              handshake.
            </p>
          </div>
          <Button variant="outline" onClick={runTest} disabled={test === "running" || !apiKey}>
            {test === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {test === "running" ? "Testing…" : "Test"}
          </Button>
        </div>

        {test !== "idle" && (
          <div
            className={cn(
              "mt-4 flex items-start gap-2 border px-3 py-2 text-sm",
              test === "success"
                ? "border-success/40 bg-success/10 text-success"
                : test === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground"
            )}
          >
            {test === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : test === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            )}
            <span>{testMsg || (test === "running" ? "Running initialize…" : "")}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          className="h-auto min-h-12 whitespace-normal py-2 text-center"
          onClick={finish}
          disabled={finishing}
        >
          {finishing ? "Finishing…" : "I'm done — go to dashboard"}
        </Button>
      </div>
    </div>
  );
}
