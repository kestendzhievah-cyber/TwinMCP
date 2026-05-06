"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import type { IdePreference } from "./step-welcome";

interface StepConnectProps {
  serverId: string;
  serverName: string;
  endpointUrl: string | null;
  ide: IdePreference;
  onFinish: () => void;
  onBack: () => void;
}

interface IdeConfig {
  filename: string;
  language: string;
  build: (url: string, key: string, name: string) => string;
}

const ideConfigs: Record<IdePreference, IdeConfig> = {
  cursor: {
    filename: "~/.cursor/mcp.json",
    language: "json",
    build: (url, key, name) =>
      JSON.stringify(
        { mcpServers: { [name]: { url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2
      ),
  },
  "claude-code": {
    filename: "~/.claude/settings.json",
    language: "json",
    build: (url, key, name) =>
      JSON.stringify(
        { mcpServers: { [name]: { url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2
      ),
  },
  windsurf: {
    filename: "~/.codeium/windsurf/mcp_config.json",
    language: "json",
    build: (url, key, name) =>
      JSON.stringify(
        { mcpServers: { [name]: { serverUrl: url, apiKey: key } } },
        null,
        2
      ),
  },
  cline: {
    filename: "Cline → MCP Servers (VS Code)",
    language: "json",
    build: (url, key, name) =>
      JSON.stringify(
        { mcpServers: { [name]: { url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2
      ),
  },
  zed: {
    filename: "~/.config/zed/settings.json",
    language: "json",
    build: (url, key, name) =>
      JSON.stringify(
        {
          context_servers: {
            [name]: { command: "npx", args: ["-y", "@twinmcp/proxy", url, key] },
          },
        },
        null,
        2
      ),
  },
  other: {
    filename: "Generic JSON-RPC client",
    language: "shell",
    build: (url, key) =>
      `# TwinMCP server endpoint\nURL: ${url}\n# Bearer token (use as Authorization header)\nKEY: ${key}\n\n# Quick test:\ncurl -H "Authorization: Bearer ${key}" ${url}/health`,
  },
};

type TestState = "idle" | "running" | "success" | "error";

export function StepConnect({
  serverId,
  serverName,
  endpointUrl,
  ide,
  onFinish,
  onBack,
}: StepConnectProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState("");
  const [test, setTest] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [finishing, setFinishing] = useState(false);

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
        if (!cancelled) setKeyError("Could not auto-create an API key. Generate one from /dashboard.");
      }
    }
    void mint();
    return () => {
      cancelled = true;
    };
  }, [serverName]);

  const url = endpointUrl ?? `https://${serverName}.mcp.twinmcp.dev`;
  const cfg = ideConfigs[ide];
  const snippet = apiKey
    ? cfg.build(url, apiKey, serverName)
    : cfg.build(url, "tmcp_••••••••••••••••", serverName);

  async function runTest() {
    setTest("running");
    setTestMsg("");
    try {
      const res = await fetch(`/api/v2/servers/${serverId}/health`);
      if (!res.ok) {
        setTest("error");
        setTestMsg("Health endpoint returned an error.");
        return;
      }
      const data = (await res.json()) as { status: string; live: boolean | null };
      if (data.status === "running" && data.live !== false) {
        setTest("success");
        setTestMsg("Server is live and reachable.");
      } else {
        setTest("error");
        setTestMsg(
          data.status === "running"
            ? "Server is running but the runtime ping didn't respond yet — give it a few more seconds."
            : `Server status: ${data.status}.`
        );
      }
    } catch (err) {
      console.error("[onboarding test]", err);
      setTest("error");
      setTestMsg("Network error — try again.");
    }
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Connect your IDE.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop this block into your config. Your API key is shown once — copy it now, you can
          rotate it later from <code className="font-mono">/dashboard</code>.
        </p>
      </div>

      {keyError && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {keyError}
        </p>
      )}

      <CodeSnippet code={snippet} language={cfg.language} filename={cfg.filename} />

      <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Test connection</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pings your server runtime to confirm it&apos;s reachable.
            </p>
          </div>
          <Button variant="outline" onClick={runTest} disabled={test === "running"}>
            {test === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {test === "running" ? "Pinging…" : "Test"}
          </Button>
        </div>

        {test !== "idle" && (
          <div
            className={
              "mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs " +
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
            <span>{testMsg || (test === "running" ? "Pinging server…" : "")}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={finish} disabled={finishing}>
          {finishing ? "Finishing…" : "I'm done — go to dashboard"}
        </Button>
      </div>
    </div>
  );
}
