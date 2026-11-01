"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Route } from "next";
import {
  AlertCircle,
  AlertTriangle,
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
import { fieldClasses } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand/brand-logo";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { cn } from "@/lib/utils";
import { CLI_PACKAGE, localAgentCommand } from "@/lib/cli";
import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  buildClientConfig,
  buildServerUrl,
  proxyUrl,
  serverConfigLabel,
  type IdeKey,
} from "@/lib/mcp/client-config";
import { sampleToolPrompt } from "@/lib/mcp/onboarding-catalog";
import { connectKeyName } from "@/lib/auth/key-scope";
import { formatDateTime } from "@/lib/format";
import { useApiKey } from "@/components/onboarding/use-api-key";
import { useConnectionTest } from "@/components/onboarding/use-connection-test";

interface ConnectMcp {
  slug: string;
  name: string;
  enabled: boolean;
}

const IDE_KEYS = Object.keys(IDE_LABELS) as IdeKey[];

const fieldLabel = "text-sm font-medium leading-none text-foreground";
// Choice chips: the selected one is filled brand blue (the colour of selection).
const chip =
  "min-h-10 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const chipOn = "border-brand bg-brand text-brand-foreground";
const chipOff = "border-input bg-card text-foreground hover:bg-accent";

/** Whole server behind one URL (contract D3), or one URL per MCP. */
type ConnectScope = "server" | "mcp";

export function ConnectPanel({
  serverId: serverIdProp,
  serverSlug,
  serverName,
  mcps,
  hostType,
  status,
  initialIde,
}: {
  /** The server's id, for binding the key. Defaults to the /dashboard/servers/[id] param. */
  serverId?: string;
  serverSlug: string;
  /** For naming a new key "<server> · <IDE>" and preferring its existing key. */
  serverName?: string;
  mcps: ConnectMcp[];
  hostType?: string;
  status?: string;
  /** users.metadata.ide_preference (picked during onboarding). */
  initialIde?: IdeKey | null;
}) {
  const enabled = useMemo(() => mcps.filter((m) => m.enabled), [mcps]);
  const isLocalAgent = hostType === "local_agent";
  const label = serverName ?? serverSlug;

  const [origin, setOrigin] = useState("");
  const [ide, setIde] = useState<IdeKey>(initialIde ?? "cursor");
  const [mcpSlug, setMcpSlug] = useState<string>(enabled[0]?.slug ?? "");
  const [scope, setScope] = useState<ConnectScope>("server");
  const [router, setRouter] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  // The panel lives on /dashboard/servers/[id]: the route param is the server id.
  const params = useParams<{ id?: string }>();
  const serverId = serverIdProp ?? (typeof params?.id === "string" ? params.id : undefined);
  // An MCP-proxy-only key bound to this server: it lands in plain text in the
  // client config, so it must not be able to manage the account.
  const key = useApiKey({
    keyName: connectKeyName(label, IDE_LABELS[ide]),
    preferNamePrefix: label,
    serverId,
  });
  const test = useConnectionTest("server");
  const apiKey = key.apiKey;

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = !origin
    ? ""
    : scope === "server"
      ? buildServerUrl(origin, serverSlug, { router })
      : mcpSlug
        ? proxyUrl(origin, serverSlug, mcpSlug)
        : "";
  const configLabel = scope === "server" ? serverConfigLabel(serverSlug) : mcpSlug;
  const cfg = useMemo(
    () =>
      buildClientConfig(ide, { url, apiKey: apiKey ?? API_KEY_PLACEHOLDER, label: configLabel }),
    [ide, url, apiKey, configLabel]
  );
  const mcpName =
    scope === "server" ? label : (enabled.find((m) => m.slug === mcpSlug)?.name ?? mcpSlug);
  // The "try it" prompt: on the whole-server URL, about its first MCP (tools
  // there are named <mcp>__<tool>; in router mode the model finds them itself).
  const sampleSlug = scope === "server" ? (enabled[0]?.slug ?? "") : mcpSlug;
  const sampleTools =
    scope === "mcp"
      ? test.tools
      : router
        ? undefined
        : test.tools.filter((t) => t.startsWith(`${sampleSlug}__`));
  const ideName = ide === "other" ? "your MCP client" : IDE_LABELS[ide];

  function createKey() {
    // Minting is additive — the previous key keeps working until it's revoked.
    // Confirm so a "create another" click doesn't silently use a key slot.
    if (
      apiKey &&
      !window.confirm(
        "Create another API key? Your current key keeps working until you revoke it on the API Keys page, and the new one uses a key slot of your plan."
      )
    ) {
      return;
    }
    void key.mint();
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

  function runTest() {
    if (!apiKey || !url) return;
    void test.run(url, apiKey, mcpName);
  }

  // A box server with nothing installed has nothing to connect to. A local-
  // agent server still needs the agent instructions (and a key for them).
  if (mcps.length === 0 && !isLocalAgent) {
    return null;
  }

  const hasMcp = enabled.length > 0;
  const testing = test.phase === "running" || test.phase === "installing";
  const keyBusy = key.phase === "loading" || key.phase === "working";

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-brand"
          >
            <Plug className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <CardTitle as="h2">Connect your LLM</CardTitle>
            <CardDescription>
              One URL for the whole server, or one per MCP. Paste it into your client, then connect
              with a <code className="font-mono text-xs">ctx7sk_</code> API key. Keys made here can
              only call this server&apos;s MCPs, never manage your account.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5 sm:pt-6">
        {isLocalAgent && (
          <div className="space-y-3 rounded-xl border border-info/30 bg-info/10 p-4 text-sm">
            <p className="font-semibold text-info">Run the local agent</p>
            <p className="text-muted-foreground">
              This server&apos;s tools run on your machine. Start the agent there so your LLM can
              reach them, and keep it running. This uses the TwinMCP CLI (
              <code className="font-mono text-xs">{CLI_PACKAGE}</code>, its{" "}
              <code className="font-mono text-xs">connect</code> command) and needs Node 18+ on that
              machine.
            </p>
            <CodeSnippet
              code={localAgentCommand(serverSlug, apiKey ?? API_KEY_PLACEHOLDER)}
              language="bash"
              filename="Run in your terminal, on the machine that hosts the tool"
            />
            <p className="text-xs text-muted-foreground">
              {apiKey
                ? "Your key is in the command above. The status badge turns running once the agent is connected."
                : "Get a key below and it drops into the command. The status badge turns running once the agent is connected."}
            </p>
            {mcps.length === 0 && (
              <p className="text-muted-foreground">
                No local tool on this server yet —{" "}
                <Link
                  href={"/dashboard/marketplace" as Route}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  add one from the Marketplace
                </Link>
                , then run the agent.
              </p>
            )}
          </div>
        )}
        {!isLocalAgent && status && status !== "running" && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your server is <strong>{status}</strong> — the connection details below start working
              once it reaches <strong>running</strong>.
            </span>
          </p>
        )}

        {hasMcp && (
          <>
            {/* Which client first (the logo tabs), then which endpoint. */}
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <p id="connect-client-label" className={fieldLabel}>
                  Client
                </p>
                <div
                  role="group"
                  aria-labelledby="connect-client-label"
                  className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-secondary p-1"
                >
                  {IDE_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setIde(k)}
                      aria-pressed={ide === k}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        ide === k
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {/* Logos only where the brand allows it (no VS Code mark). */}
                      <BrandLogo slug={k} size={16} decorative />
                      {IDE_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p id="connect-scope-label" className={fieldLabel}>
                  Endpoint
                </p>
                <div
                  role="group"
                  aria-labelledby="connect-scope-label"
                  className="flex flex-wrap gap-2"
                >
                  {(
                    [
                      ["server", "One URL for this whole server (recommended)"],
                      ["mcp", "One URL per MCP"],
                    ] as const
                  ).map(([k, text]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setScope(k);
                        test.reset();
                      }}
                      aria-pressed={scope === k}
                      className={cn(chip, scope === k ? chipOn : chipOff)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {scope === "server" ? (
                    <>
                      Every enabled MCP of {label} behind one endpoint. Tools are named{" "}
                      <code className="font-mono">mcp__tool</code>; an MCP you add later appears the
                      next time your client reloads its tools, with no config change.
                    </>
                  ) : (
                    "One endpoint for a single MCP, if you want a client to see only its tools."
                  )}
                </p>
                {scope === "server" && (
                  <label className="flex min-h-10 cursor-pointer items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={router}
                      onChange={(e) => {
                        setRouter(e.target.checked);
                        test.reset();
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        Router mode for large servers
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Your client sees three tools (search, read a schema, call) instead of every
                        tool, which keeps its context small. Search is free; each call counts as one
                        tool call.
                      </span>
                    </span>
                  </label>
                )}
              </div>
              {scope === "mcp" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="connect-mcp">MCP</Label>
                  <select
                    id="connect-mcp"
                    value={mcpSlug}
                    onChange={(e) => {
                      setMcpSlug(e.target.value);
                      test.reset();
                    }}
                    className={cn(fieldClasses, "h-10 max-w-xs [&>option]:bg-card")}
                  >
                    {enabled.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* The endpoint and its copy button: the panel's primary action. */}
            <div className="space-y-2">
              <p id="connect-url-label" className={fieldLabel}>
                Connection URL
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex h-10 min-w-0 flex-1 items-center truncate rounded-lg border border-border bg-secondary px-3 font-mono text-xs sm:text-sm">
                  <span className="truncate">{url || "…"}</span>
                </code>
                <Button
                  type="button"
                  onClick={copyUrl}
                  disabled={!url}
                  className="w-full sm:w-auto"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy URL"}
                </Button>
              </div>
            </div>

            <CodeSnippet code={cfg.code} language={cfg.language} filename={cfg.filename} />
          </>
        )}

        {!apiKey && (
          <p className="flex items-start gap-2 rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
            <KeyRound aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The <code className="font-mono">ctx7sk_…</code> {hasMcp ? "in the snippet" : "above"}{" "}
              is a <strong>placeholder</strong>, not your key.{" "}
              {key.existing ? (
                <>
                  A key&apos;s secret is shown <strong>only once</strong>, so reuse this
                  server&apos;s key by rotating it: you get a fresh secret here and the old one
                  keeps working for 24 hours, then stops — update any client that still uses it.
                </>
              ) : (
                <>
                  Generate one below and it drops in — it&apos;s shown <strong>only once</strong>,
                  so copy it right away.
                </>
              )}
            </span>
          </p>
        )}

        {/* Get a key (reuse the existing one first), then prove the handshake.
            Outline: the copy button above is the panel's one primary. A local
            agent server has no URL to copy, so its key button is the primary. */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          {!apiKey && key.existing && (
            <Button
              variant={hasMcp ? "outline" : "default"}
              onClick={() => key.existing && void key.rotate(key.existing)}
              disabled={keyBusy}
            >
              {key.phase === "working" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Use {key.existing.name ?? key.existing.prefix} (rotate to reveal)
            </Button>
          )}
          <Button
            variant={apiKey || key.existing || hasMcp ? "outline" : "default"}
            onClick={createKey}
            disabled={keyBusy}
          >
            {keyBusy && !key.existing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {apiKey ? "Create another key" : key.existing ? "Create a new key" : "Generate API key"}
          </Button>
          {hasMcp && (
            <Button variant="outline" onClick={runTest} disabled={testing || !apiKey}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {testing ? "Testing…" : "Test connection"}
            </Button>
          )}
        </div>

        {apiKey && (
          <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
            <div>
              <p className="text-sm font-semibold text-warning">Your API key</p>
              <p className="mt-1 text-xs text-warning">
                Copy it now — it&apos;s shown only once (also embedded above). It can only call MCPs
                on {label}.
              </p>
              {key.oldKeyExpiresAt && (
                <p className="mt-1 text-xs text-warning">
                  The previous secret keeps working until{" "}
                  <span className="tabular-nums">{formatDateTime(key.oldKeyExpiresAt)}</span>, then
                  stops.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card py-1 pl-3 pr-1">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground sm:text-sm">
                {apiKey}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={copyKey}
                aria-label="Copy API key"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
              >
                {keyCopied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {key.error && (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {key.error}
          </p>
        )}

        {test.phase !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
              test.phase === "success"
                ? "border-success/30 bg-success/10 text-success"
                : test.phase === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-secondary text-muted-foreground"
            )}
          >
            {test.phase === "success" ? (
              <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            ) : test.phase === "error" ? (
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Loader2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            )}
            <span>
              {test.message || "Running initialize…"}
              {test.phase === "error" && (
                <>
                  {" "}
                  <a
                    href="/docs#troubleshooting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
                  >
                    Troubleshooting guide
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </a>
                </>
              )}
            </span>
          </div>
        )}

        {test.phase === "success" && (
          <div className="space-y-1 border-t border-border pt-4 text-sm">
            <p className="font-semibold text-foreground">Try it</p>
            <p>
              In {ideName}, ask:{" "}
              <span className="font-medium">
                &ldquo;{sampleToolPrompt(sampleSlug, sampleTools)}&rdquo;
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              The call appears in the Activity tab of this server.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
