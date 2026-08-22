"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  buildClientConfig,
  proxyUrl,
  testMcpConnection,
  type IdeKey,
} from "@/lib/mcp/client-config";

interface ConnectMcp {
  slug: string;
  name: string;
  enabled: boolean;
}

type TestState = "idle" | "running" | "success" | "error";

const IDE_KEYS = Object.keys(IDE_LABELS) as IdeKey[];

export function ConnectPanel({
  serverSlug,
  mcps,
  hostType,
}: {
  serverSlug: string;
  mcps: ConnectMcp[];
  hostType?: string;
}) {
  const enabled = useMemo(() => mcps.filter((m) => m.enabled), [mcps]);

  const [origin, setOrigin] = useState("");
  const [ide, setIde] = useState<IdeKey>("cursor");
  const [mcpSlug, setMcpSlug] = useState<string>(enabled[0]?.slug ?? mcps[0]?.slug ?? "");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [test, setTest] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = origin && mcpSlug ? proxyUrl(origin, serverSlug, mcpSlug) : "";
  const cfg = useMemo(
    () => buildClientConfig(ide, { url, apiKey: apiKey ?? API_KEY_PLACEHOLDER, label: mcpSlug }),
    [ide, url, apiKey, mcpSlug]
  );

  async function generateKey() {
    setGenerating(true);
    setKeyError("");
    try {
      const res = await fetch("/api/v2/auth/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `${serverSlug} · dashboard` }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setKeyError(e.message ?? "Could not create an API key. Try from the API keys page.");
        return;
      }
      const data = (await res.json()) as { key: string };
      setApiKey(data.key);
    } catch (err) {
      console.error("[connect generate key]", err);
      setKeyError("Network error — try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function copyKey() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 1800);
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

  if (mcps.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connect your LLM</CardTitle>
        <CardDescription>
          One URL per MCP. Paste this into your client, then connect with a{" "}
          <code className="font-mono text-xs">ctx7sk_</code> API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hostType === "local_agent" && (
          <div className="space-y-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
            <p className="font-medium text-sky-700 dark:text-sky-400">Run the local agent</p>
            <p className="text-muted-foreground">
              This server&apos;s tools run on your machine. Start the agent so your LLM can reach
              them (keep it running):
            </p>
            <CodeSnippet
              code={`npx ctx7 connect --server ${serverSlug}`}
              language="bash"
              filename="Run in your terminal (needs Node)"
            />
            <p className="text-muted-foreground">
              The status badge above turns <strong>running</strong> once the agent is connected.
            </p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              MCP
            </label>
            <select
              value={mcpSlug}
              onChange={(e) => setMcpSlug(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground [&>option]:bg-background [&>option]:text-foreground"
            >
              {mcps.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                  {m.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Client
            </label>
            <select
              value={ide}
              onChange={(e) => setIde(e.target.value as IdeKey)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground [&>option]:bg-background [&>option]:text-foreground"
            >
              {IDE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {IDE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Connection URL
          </p>
          <div className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs">{url || "…"}</code>
            <button
              type="button"
              onClick={copyUrl}
              aria-label="Copy URL"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border/80 bg-background/95 text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        <CodeSnippet code={cfg.code} language={cfg.language} filename={cfg.filename} />

        {!apiKey && (
          <p className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-700 dark:text-sky-400">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              The <code className="font-mono">ctx7sk_…</code> in the snippet is a{" "}
              <strong>placeholder</strong>, not your key. Click <strong>Generate API key</strong>{" "}
              below and your real key drops into the snippet — it&apos;s shown{" "}
              <strong>only once</strong>, so copy it right away.
            </span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={apiKey ? "outline" : "default"}
            size="sm"
            onClick={generateKey}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            {apiKey ? "Rotate API key" : "Generate API key"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runTest}
            disabled={test === "running" || !apiKey}
          >
            {test === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {test === "running" ? "Testing…" : "Test connection"}
          </Button>
        </div>

        {apiKey && (
          <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Your API key — copy it now, it&apos;s shown only once (also embedded in the snippet
              above).
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs">{apiKey}</code>
              <button
                type="button"
                onClick={copyKey}
                aria-label="Copy API key"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border/80 bg-background/95 text-muted-foreground transition-colors hover:text-foreground"
              >
                {keyCopied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {keyError && (
          <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {keyError}
          </p>
        )}

        {test !== "idle" && (
          <div
            className={
              "flex items-start gap-2 rounded-md border px-3 py-2 text-xs " +
              (test === "success"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : test === "error"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-border/60 bg-background text-muted-foreground")
            }
          >
            {test === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : test === "error" ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            )}
            <span>{testMsg}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
