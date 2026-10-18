"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { cn } from "@/lib/utils";
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
  status,
}: {
  serverSlug: string;
  mcps: ConnectMcp[];
  hostType?: string;
  status?: string;
}) {
  const enabled = useMemo(() => mcps.filter((m) => m.enabled), [mcps]);

  const [origin, setOrigin] = useState("");
  const [ide, setIde] = useState<IdeKey>("cursor");
  const [mcpSlug, setMcpSlug] = useState<string>(enabled[0]?.slug ?? "");
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
    // Minting is additive — the previous key keeps working until it's revoked.
    // Confirm so a "generate another" click doesn't silently orphan a key the
    // user already pasted into a client.
    if (
      apiKey &&
      !window.confirm(
        "Generate a new API key? Your current key keeps working until you revoke it on the API Keys page."
      )
    ) {
      return;
    }
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
      {/* Ruled header: hairline icon square + small-caps title, the brief in italic under it. */}
      <CardHeader className="border-b border-border px-6 py-4">
        <CardTitle className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
            <Plug className="h-4 w-4" />
          </span>
          Connect your LLM
        </CardTitle>
        <CardDescription className="pl-12">
          One URL per MCP. Paste this into your client, then connect with a{" "}
          <code className="font-mono text-xs not-italic">ctx7sk_</code> API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {hostType === "local_agent" && (
          <div className="space-y-3 border border-info/40 border-l-2 border-l-info bg-info/10 p-4 text-sm">
            <p className="smallcaps tracking-sc text-xs font-medium text-info">
              Run the local agent
            </p>
            <p className="text-muted-foreground">
              This server&apos;s tools run on your machine. Start the agent so your LLM can reach
              them (keep it running):
            </p>
            <CodeSnippet
              code={`npx ctx7 connect --server ${serverSlug}`}
              language="bash"
              filename="Run in your terminal (needs Node)"
            />
            <p className="text-xs italic text-muted-foreground">
              The status badge above turns <strong>running</strong> once the agent is connected.
            </p>
          </div>
        )}
        {hostType !== "local_agent" && status && status !== "running" && (
          <p className="flex items-start gap-2 border border-warning/40 border-l-2 border-l-warning bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your server is <strong>{status}</strong> — the connection details below start working
              once it reaches <strong>running</strong>.
            </span>
          </p>
        )}

        {/* Which MCP, which client. The MCP list is data (a select); the client is a
            row of hairline stamps, the chosen one pressed in ink. */}
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="connect-mcp">MCP</Label>
            <select
              id="connect-mcp"
              value={mcpSlug}
              onChange={(e) => setMcpSlug(e.target.value)}
              className="h-10 w-full max-w-xs border border-input bg-card px-3 text-sm text-foreground shadow-inner transition-colors focus-visible:border-foreground focus-visible:outline-none [&>option]:bg-card [&>option]:text-foreground"
            >
              {enabled.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <p
              id="connect-client-label"
              className="smallcaps tracking-sc text-xs font-medium leading-none text-foreground/85"
            >
              Client
            </p>
            <div
              role="group"
              aria-labelledby="connect-client-label"
              className="flex flex-wrap gap-2"
            >
              {IDE_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIde(k)}
                  aria-pressed={ide === k}
                  className={cn(
                    "smallcaps tracking-sc h-10 border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-px",
                    ide === k
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/60 hover:text-foreground"
                  )}
                >
                  {IDE_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The endpoint: a typewriter line on darker stock, the copy button a
            hairline square (DESIGN.md §4.6). */}
        <div className="space-y-2">
          <p className="smallcaps tracking-sc text-xs font-medium leading-none text-foreground/85">
            Connection URL
          </p>
          <div className="flex items-center gap-3 border border-border bg-secondary/60 py-1.5 pl-3 pr-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
              {url || "…"}
            </code>
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

        {!apiKey && (
          <p className="flex items-start gap-2 border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The <code className="font-mono">ctx7sk_…</code> in the snippet is a{" "}
              <strong>placeholder</strong>, not your key. Click <strong>Generate API key</strong>{" "}
              below and your real key drops into the snippet — it&apos;s shown{" "}
              <strong>only once</strong>, so copy it right away.
            </span>
          </p>
        )}

        {/* Mint a key, then prove the handshake. */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button
            variant={apiKey ? "outline" : "default"}
            onClick={generateKey}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {apiKey ? "Generate another key" : "Generate API key"}
          </Button>
          <Button variant="outline" onClick={runTest} disabled={test === "running" || !apiKey}>
            {test === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {test === "running" ? "Testing…" : "Test connection"}
          </Button>
        </div>

        {apiKey && (
          <div className="space-y-3 border border-warning/40 border-l-2 border-l-warning bg-warning/10 p-4">
            <div>
              <p className="smallcaps tracking-sc text-xs font-medium text-warning">Your API key</p>
              <p className="mt-1 text-xs italic text-warning">
                Copy it now — it&apos;s shown only once (also embedded in the snippet above).
              </p>
            </div>
            <div className="flex items-center gap-3 border border-border bg-card py-1.5 pl-3 pr-1.5">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground sm:text-sm">
                {apiKey}
              </code>
              <button
                type="button"
                onClick={copyKey}
                aria-label="Copy API key"
                className="grid h-10 w-10 shrink-0 place-items-center border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground"
              >
                {keyCopied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {keyError && (
          <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {keyError}
          </p>
        )}

        {test !== "idle" && (
          <div
            className={cn(
              "flex items-start gap-2 border px-3 py-2 text-sm",
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
            <span>
              {testMsg}
              {test === "error" && (
                <>
                  {" "}
                  <a
                    href="/docs#troubleshooting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
                  >
                    Troubleshooting guide
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </>
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
