"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  buildClientConfig,
  buildServerUrl,
  serverConfigLabel,
  type IdeKey,
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

/** Tab labels: VS Code without the "(Copilot)" suffix, the generic tile as "Other". */
const TAB_LABELS: Record<IdeKey, string> = {
  ...IDE_LABELS,
  vscode: "VS Code",
  other: "Other",
};
const TAB_ORDER = Object.keys(IDE_LABELS) as IdeKey[];

const LABEL = "text-sm font-semibold";
const NOTE_INFO =
  "flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm text-info";

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
  // IDE config, so it must not be able to manage the account. Named after the
  // client picked on the welcome step; the tabs below only change the snippet.
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
  // The client whose config is shown: the welcome-step choice by default.
  const [viewIde, setViewIde] = useState<IdeKey>(ide);

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
      buildClientConfig(viewIde, {
        url,
        apiKey: apiKey ?? API_KEY_PLACEHOLDER,
        label: configLabel,
      }),
    [viewIde, url, apiKey, configLabel]
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
  const passed = test.phase === "success";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Connect your AI client.
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          Drop this block into {ideName(viewIde)}. Your API key is shown once, so copy it now; you
          can rotate it later from the dashboard.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This key can only call MCPs on {serverName}. It cannot manage your account, so a leaked
          config exposes this server&apos;s tools, nothing else.
        </p>
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">Connecting to</span>{" "}
          <span className="font-semibold">{serverName}</span>, every MCP on it (
          <code className="font-mono text-xs">{mcpSlug}</code> included) behind one URL.
        </p>
        {isDocsDefault && (
          <p className={cn(NOTE_INFO, "mt-3")}>
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              You skipped installing an MCP, so this connects the built-in{" "}
              <span className="font-semibold">TwinMCP Docs</span> MCP. Add more anytime from the{" "}
              <span className="font-semibold">Marketplace</span>.
            </span>
          </p>
        )}
        {justInstalled && !isDocsDefault && (
          <p className="mt-3 text-sm text-muted-foreground">
            {mcpName} installs in about a minute. Paste the config meanwhile: the test below waits
            for it by itself.
          </p>
        )}
      </div>

      {/* The key: an MCP-proxy key bound to this server, minted when none
          exists; when one does, it is rotated so repeat visits don't consume
          the plan's key slots. */}
      {!apiKey && key.phase !== "loading" && key.phase !== "working" && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-alt p-4 text-sm">
          <p className={LABEL}>API key</p>
          {key.existing ? (
            <p className="text-muted-foreground">
              You already have a key for this server. Its secret is shown only once, so rotate it to
              reveal a fresh one here. The old secret keeps working for 24 hours, then stops: update
              any client that uses it.
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
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin text-brand" />
          Preparing your API key…
        </p>
      )}

      {key.error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{key.error} You can also manage keys on the dashboard&apos;s API keys page.</span>
        </p>
      )}
      {apiKey && key.oldKeyExpiresAt && (
        <p className="text-sm text-muted-foreground">
          Key rotated. The previous secret keeps working until{" "}
          <span className="tabular-nums">{formatDateTime(key.oldKeyExpiresAt)}</span>, then stops.
        </p>
      )}

      {/* The endpoint in mono on a quiet fill, with a copy button. */}
      <div className="space-y-2">
        <p className={LABEL}>Connection URL</p>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary py-1.5 pl-3 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">{url || "…"}</code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copyUrl}
            aria-label={copied ? "URL copied" : "Copy URL"}
            className="shrink-0"
          >
            {copied ? <Check className="text-success" /> : <Copy />}
          </Button>
        </div>
      </div>

      {/* One tab per client the config generator knows, each with its mark
          (VS Code is text only); the snippet follows the selected tab. */}
      <div className="space-y-3">
        <p id="client-tabs" className={LABEL}>
          Your client
        </p>
        <div
          role="tablist"
          aria-labelledby="client-tabs"
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-secondary p-1"
        >
          {TAB_ORDER.map((k) => {
            const active = k === viewIde;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                id={`client-tab-${k}`}
                aria-selected={active}
                aria-controls="client-config"
                tabIndex={active ? 0 : -1}
                onClick={() => setViewIde(k)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const i = TAB_ORDER.indexOf(k);
                  const next =
                    TAB_ORDER[
                      (i + (e.key === "ArrowRight" ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length
                    ];
                  setViewIde(next);
                  document.getElementById(`client-tab-${next}`)?.focus();
                }}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {hasBrandLogo(k) ? (
                  <BrandLogo slug={k} size={16} decorative />
                ) : (
                  <Code2 aria-hidden className="h-4 w-4" />
                )}
                {TAB_LABELS[k]}
              </button>
            );
          })}
        </div>
        <div id="client-config" role="tabpanel" aria-labelledby={`client-tab-${viewIde}`}>
          <CodeSnippet code={cfg.code} language={cfg.language} filename={cfg.filename} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-alt p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className={LABEL}>Test connection</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A real MCP handshake (<code className="font-mono">initialize</code> and{" "}
              <code className="font-mono">tools/list</code>) through your endpoint.
            </p>
          </div>
          {/* The step's primary action until the test passes; then the
              success panel's button takes over. */}
          <Button
            variant={passed || !apiKey ? "outline" : "default"}
            onClick={runTest}
            disabled={testing || !apiKey}
            className="shrink-0"
          >
            {testing ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden className="h-4 w-4" />
            )}
            {testing ? "Testing…" : passed ? "Test again" : "Test connection"}
          </Button>
        </div>

        {test.phase !== "idle" && !passed && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
              test.phase === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {test.phase === "error" ? (
              <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Loader2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" />
            )}
            <span>{test.message || "Running initialize…"}</span>
          </div>
        )}

        {/* The moment the product proves itself: the server answered. */}
        {passed && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex flex-col items-center rounded-xl border border-success/30 bg-card px-4 py-6 text-center"
          >
            <span
              aria-hidden
              className="grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success duration-300 animate-in fade-in zoom-in-75 motion-reduce:animate-none"
            >
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <p className="mt-4 font-display text-xl font-bold tracking-tight">
              Connection works, you&apos;re live!
            </p>
            <p className="mt-1 text-sm text-success">{test.message}</p>
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-muted-foreground">
                Now, in {ideName(viewIde)}, ask:{" "}
                <span className="font-semibold text-foreground">
                  &ldquo;
                  {sampleToolPrompt(
                    mcpSlug,
                    test.tools.filter((t) => t.startsWith(`${mcpSlug}__`))
                  )}
                  &rdquo;
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                The call appears in your server&apos;s Activity tab.
              </p>
            </div>
            <Button size="lg" className="mt-5" onClick={finish} disabled={finishing}>
              {finishing ? "Opening…" : "Go to my server"}
              {!finishing && <ArrowRight aria-hidden />}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        {!passed && (
          <Button
            variant="outline"
            className="h-auto min-h-10 whitespace-normal py-2 text-center"
            onClick={finish}
            disabled={finishing}
          >
            {finishing ? "Opening…" : "Open my server"}
          </Button>
        )}
      </div>
    </div>
  );
}
