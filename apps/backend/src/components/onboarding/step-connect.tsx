"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  buildClientConfig,
  buildServerUrl,
  serverConfigLabel,
} from "@/lib/mcp/client-config";
import { sampleToolPrompt } from "@/lib/mcp/onboarding-catalog";
import { connectKeyName } from "@/lib/auth/key-scope";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IdePreference } from "./step-welcome";
import { useApiKey } from "./use-api-key";
import { useConnectionTest } from "./use-connection-test";

interface StepConnectProps {
  serverId: string;
  serverName: string;
  serverSlug: string;
  mcpSlug: string;
  /** Display name of the MCP ("Fetch"), for the "still installing" line. */
  mcpName: string;
  /** True when the user skipped installing an MCP and we default to twinmcp-docs. */
  isDocsDefault?: boolean;
  /** True when the MCP was installed a moment ago in this wizard (it is still warming up). */
  justInstalled?: boolean;
  ide: IdePreference;
  onFinish: () => void;
  onBack: () => void;
}

/** "Cursor", "Claude Desktop"… or "your MCP client" for the generic tile. */
export function ideName(ide: IdePreference): string {
  return ide === "other" ? "your MCP client" : IDE_LABELS[ide];
}

export function StepConnect({
  serverId,
  serverName,
  serverSlug,
  mcpSlug,
  mcpName,
  isDocsDefault = false,
  justInstalled = false,
  ide,
  onFinish,
  onBack,
}: StepConnectProps) {
  // An MCP-proxy-only key bound to this server: it lands in plain text in the
  // IDE config, so it must not be able to manage the account.
  const key = useApiKey({
    keyName: connectKeyName(serverName, IDE_LABELS[ide]),
    preferNamePrefix: serverName,
    serverId,
    autoMint: true,
  });
  const test = useConnectionTest("onboarding");
  const [finishing, setFinishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const apiKey = key.apiKey;
  // One URL for the whole server (contract D3): every MCP installed on it now
  // or later, tools named <mcp>__<tool>. Per-MCP URLs stay on the server page.
  const url = origin ? buildServerUrl(origin, serverSlug) : "";
  const configLabel = serverConfigLabel(serverSlug);
  const cfg = useMemo(
    () =>
      buildClientConfig(ide, { url, apiKey: apiKey ?? API_KEY_PLACEHOLDER, label: configLabel }),
    [ide, url, apiKey, configLabel]
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

  function runTest() {
    if (!apiKey || !url) return;
    void test.run(url, apiKey, mcpName);
  }

  async function finish() {
    setFinishing(true);
    test.cancel();
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

  const testing = test.phase === "running" || test.phase === "installing";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-medium md:text-3xl">Connect your LLM.</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Drop this block into {ideName(ide)}. Your API key is shown once — copy it now; you can
          rotate it later from the dashboard.
        </p>
        <p className="mt-2 text-sm italic text-muted-foreground">
          This key can only call MCPs on {serverName}. It cannot manage your account, so a leaked
          IDE config exposes this server&apos;s tools, nothing else.
        </p>
        <p className="mt-4 text-sm">
          <span className="smallcaps tracking-sc text-xs text-muted-foreground">Connecting to</span>{" "}
          <span className="font-medium">{serverName}</span>, every MCP on it (
          <code className="font-mono text-xs">{mcpSlug}</code> included) behind one URL
        </p>
        {isDocsDefault && (
          <p className="mt-3 border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
            You skipped installing an MCP, so this connects the built-in{" "}
            <span className="font-medium">TwinMCP Docs</span> MCP. Add more anytime from the{" "}
            <span className="font-medium">Marketplace</span>.
          </p>
        )}
        {justInstalled && !isDocsDefault && (
          <p className="mt-3 text-sm italic text-muted-foreground">
            {mcpName} installs in about a minute. Paste the config meanwhile — the test below waits
            for it by itself.
          </p>
        )}
      </div>

      {/* The key: an MCP-proxy key bound to this server, minted when none
          exists; when one does, it is rotated so repeat visits don't consume
          the plan's key slots. */}
      {!apiKey && key.phase !== "loading" && key.phase !== "working" && (
        <div className="space-y-3 border border-border bg-secondary/40 p-4 text-sm">
          <p className="smallcaps tracking-sc text-xs font-medium text-muted-foreground">API key</p>
          {key.existing ? (
            <p className="text-muted-foreground">
              You already have a key for this server. Its secret is shown only once, so rotate it to
              reveal a fresh one here. The old secret keeps working for 24 hours, then stops —
              update any client that uses it.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Create a key for this connection (MCP calls to {serverName} only).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {key.existing && (
              <Button size="sm" onClick={() => key.existing && void key.rotate(key.existing)}>
                <RefreshCw className="h-4 w-4" />
                Use {key.existing.name ?? key.existing.prefix} (rotate to reveal)
              </Button>
            )}
            <Button
              size="sm"
              variant={key.existing ? "outline" : "default"}
              onClick={() => void key.mint()}
            >
              <KeyRound className="h-4 w-4" />
              Create a new key
            </Button>
          </div>
        </div>
      )}
      {(key.phase === "loading" || key.phase === "working") && !apiKey && (
        <p className="flex items-center gap-2 text-sm italic text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing your API key…
        </p>
      )}

      {key.error && (
        <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{key.error} You can also manage keys on the dashboard&apos;s API keys page.</span>
        </p>
      )}
      {apiKey && key.oldKeyExpiresAt && (
        <p className="text-sm italic text-muted-foreground">
          Key rotated. The previous secret keeps working until{" "}
          <span className="lining not-italic">{formatDateTime(key.oldKeyExpiresAt)}</span>, then
          stops.
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
              A real MCP handshake (<code className="font-mono not-italic">initialize</code> and{" "}
              <code className="font-mono not-italic">tools/list</code>) through your endpoint.
            </p>
          </div>
          <Button variant="outline" onClick={runTest} disabled={testing || !apiKey}>
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {testing ? "Testing…" : "Test"}
          </Button>
        </div>

        {test.phase !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "mt-4 flex items-start gap-2 border px-3 py-2 text-sm",
              test.phase === "success"
                ? "border-success/40 bg-success/10 text-success"
                : test.phase === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground"
            )}
          >
            {test.phase === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : test.phase === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            )}
            <span>{test.message || "Running initialize…"}</span>
          </div>
        )}

        {/* The moment the product proves itself: one real tool call. */}
        {test.phase === "success" && (
          <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <p className="smallcaps tracking-sc text-xs font-medium text-muted-foreground">
              Try it
            </p>
            <p>
              In {ideName(ide)}, ask:{" "}
              <span className="font-medium">
                &ldquo;
                {sampleToolPrompt(
                  mcpSlug,
                  test.tools.filter((t) => t.startsWith(`${mcpSlug}__`))
                )}
                &rdquo;
              </span>
            </p>
            <p className="text-xs italic text-muted-foreground">
              The call appears in your server&apos;s Activity tab.
            </p>
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
          {finishing ? "Opening…" : "Open my server"}
        </Button>
      </div>
    </div>
  );
}
