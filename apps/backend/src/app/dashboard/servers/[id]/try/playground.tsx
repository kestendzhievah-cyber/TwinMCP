"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LifecycleState } from "@/lib/server-lifecycle";
import { localAgentCommand } from "@/lib/cli";
import {
  argumentsToFormValues,
  buildArguments,
  initialFormValues,
  parseRawArguments,
  schemaToForm,
  type FormValues,
} from "@/lib/mcp/schema-form";
import {
  extractTools,
  needsConfirmation,
  nextRetryDelayMs,
  searchTools,
  toolBadges,
  type PlaygroundTool,
  type TryRequestBody,
  type TryResponse,
} from "./protocol";
import { formatEur, priceToolCallsMicros } from "@/lib/wallet/pricing";

const CALL_PRICE = formatEur(priceToolCallsMicros(1), "en");
import { ToolForm, textareaClass } from "./tool-form";
import { ResultPanel } from "./result-panel";

interface McpOption {
  slug: string;
  name: string;
  description: string | null;
}

type Waiting = { message: string; since: number } | null;

function isTryResponse(v: unknown): v is TryResponse {
  return !!v && typeof v === "object" && "status" in v && "requestId" in v;
}

/** A non-TryResponse answer (401, 400, network) as a TryResponse to display. */
function localError(message: string, latencyMs = 0): TryResponse {
  return {
    ok: false,
    status: "error",
    error: { code: 0, message },
    latencyMs,
    requestId: "",
    raw: null,
  };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * POST to the playground relay, retrying a 503 (box waking up, MCP still
 * installing) for up to two minutes. A 503 means the request never ran, so a
 * retried tool call cannot run twice.
 */
async function callTry(
  serverId: string,
  body: TryRequestBody,
  signal: AbortSignal,
  onWaiting: (w: Waiting) => void
): Promise<TryResponse> {
  const start = Date.now();
  for (;;) {
    let data: unknown;
    let status: number;
    try {
      const res = await fetch(`/api/v2/servers/${serverId}/try`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
        cache: "no-store",
      });
      status = res.status;
      data = await res.json().catch(() => null);
    } catch (err) {
      if (signal.aborted) throw err;
      return localError("Network error: the dashboard could not reach TwinMCP.");
    }
    if (!isTryResponse(data)) {
      const msg =
        data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message)
          : `Request failed (HTTP ${status}).`;
      return localError(msg, Date.now() - start);
    }
    if (status === 503 && data.status === "waking") {
      const delay = nextRetryDelayMs(data.retryAfterSec, Date.now() - start);
      if (delay === null) return data;
      onWaiting({ message: data.error?.message ?? "Waking up (about a minute)…", since: start });
      await sleep(delay, signal);
      continue;
    }
    return data;
  }
}

function useElapsed(since: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

function WakingNotice({ waiting, onCancel }: { waiting: Waiting; onCancel: () => void }) {
  const elapsed = useElapsed(waiting?.since ?? null);
  if (!waiting) return null;
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div
      role="status"
      className="flex flex-wrap items-start justify-between gap-3 border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info"
    >
      <div className="flex items-start gap-2">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
        <p>
          {waiting.message}{" "}
          <span className="lining italic">
            Retrying automatically for up to 2 minutes · {mm}:{ss}
          </span>
        </p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="h-7 text-info">
        Stop waiting
      </Button>
    </div>
  );
}

function ToolBadges({ tool }: { tool: PlaygroundTool }) {
  const { readOnly, destructive } = toolBadges(tool);
  return (
    <>
      {readOnly && <Badge variant="info">Read-only</Badge>}
      {destructive && <Badge variant="destructive">Destructive</Badge>}
    </>
  );
}

export function ToolPlayground({
  serverId,
  serverSlug,
  mcps,
  disabledCount,
  lifecycle,
}: {
  serverId: string;
  /** For the local-agent command in the offline notice. */
  serverSlug?: string;
  mcps: McpOption[];
  disabledCount: number;
  lifecycle: LifecycleState;
}) {
  const [mcpSlug, setMcpSlug] = useState<string>(mcps[0]?.slug ?? "");

  // Tools list
  const [tools, setTools] = useState<PlaygroundTool[]>([]);
  const [listResponse, setListResponse] = useState<TryResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listWaiting, setListWaiting] = useState<Waiting>(null);
  const [query, setQuery] = useState("");
  const listAbort = useRef<AbortController | null>(null);

  // Selected tool + its form
  const [toolName, setToolName] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState("{}");
  const [rawError, setRawError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Run
  const [running, setRunning] = useState(false);
  const [runWaiting, setRunWaiting] = useState<Waiting>(null);
  const [runResponse, setRunResponse] = useState<TryResponse | null>(null);
  const runAbort = useRef<AbortController | null>(null);

  const tool = useMemo(() => tools.find((t) => t.name === toolName) ?? null, [tools, toolName]);
  // Keyed on the tool's name and schema text, not on object identity: Reload
  // tools rebuilds every tool object, and must not wipe the arguments typed.
  const formKey = tool ? `${tool.name}\u0000${JSON.stringify({ s: tool.inputSchema })}` : "";
  const form = useMemo(() => {
    if (!formKey) return schemaToForm(undefined);
    const json = formKey.slice(formKey.indexOf("\u0000") + 1);
    return schemaToForm((JSON.parse(json) as { s?: unknown }).s);
  }, [formKey]);
  const visibleTools = useMemo(() => searchTools(tools, query), [tools, query]);
  const mcp = mcps.find((m) => m.slug === mcpSlug) ?? null;

  const loadTools = useCallback(async () => {
    if (!mcpSlug) return;
    listAbort.current?.abort();
    const ac = new AbortController();
    listAbort.current = ac;
    setListLoading(true);
    setListResponse(null);
    setListWaiting(null);
    try {
      const res = await callTry(
        serverId,
        { mcpSlug, method: "tools/list" },
        ac.signal,
        setListWaiting
      );
      if (ac.signal.aborted) return;
      setListResponse(res);
      const next = res.ok ? extractTools(res.result) : [];
      setTools(next);
      setToolName((cur) =>
        cur && next.some((t) => t.name === cur) ? cur : (next[0]?.name ?? null)
      );
    } catch {
      /* aborted: a newer load (or Stop waiting) took over */
    } finally {
      if (listAbort.current === ac) {
        setListLoading(false);
        setListWaiting(null);
      }
    }
  }, [mcpSlug, serverId]);

  // Load the tools whenever the MCP changes; abort the previous load.
  useEffect(() => {
    setTools([]);
    setToolName(null);
    setRunResponse(null);
    void loadTools();
    return () => listAbort.current?.abort();
  }, [loadTools]);

  // Fresh form whenever the selected tool changes.
  useEffect(() => {
    const initial = initialFormValues(form.fields);
    setValues(initial);
    setFieldErrors({});
    setRawError(null);
    setRawMode(form.rawOnly);
    const built = buildArguments(form.fields, initial);
    setRawText(JSON.stringify(built.ok ? built.args : {}, null, 2));
    setRunResponse(null);
    runAbort.current?.abort();
  }, [form]);

  function switchToRaw() {
    const built = buildArguments(form.fields, values);
    if (built.ok) setRawText(JSON.stringify(built.args, null, 2));
    setRawError(null);
    setRawMode(true);
  }

  function switchToForm() {
    const parsed = parseRawArguments(rawText);
    if (!parsed.ok) {
      setRawError(parsed.error);
      return;
    }
    setValues(argumentsToFormValues(form.fields, parsed.args));
    setFieldErrors({});
    setRawMode(false);
  }

  /** Validate the arguments; null (with the errors shown) when invalid. */
  function currentArguments(): Record<string, unknown> | null {
    if (rawMode) {
      const parsed = parseRawArguments(rawText);
      if (!parsed.ok) {
        setRawError(parsed.error);
        return null;
      }
      setRawError(null);
      return parsed.args;
    }
    const built = buildArguments(form.fields, values);
    if (!built.ok) {
      setFieldErrors(built.errors);
      return null;
    }
    setFieldErrors({});
    return built.args;
  }

  function requestRun() {
    if (!tool || running) return;
    if (currentArguments() === null) return;
    if (needsConfirmation(tool)) {
      setConfirmOpen(true);
      return;
    }
    void run();
  }

  async function run() {
    setConfirmOpen(false);
    if (!tool) return;
    const args = currentArguments();
    if (args === null) return;
    runAbort.current?.abort();
    const ac = new AbortController();
    runAbort.current = ac;
    setRunning(true);
    setRunResponse(null);
    setRunWaiting(null);
    try {
      const res = await callTry(
        serverId,
        { mcpSlug, method: "tools/call", name: tool.name, arguments: args },
        ac.signal,
        setRunWaiting
      );
      if (!ac.signal.aborted) setRunResponse(res);
    } catch {
      /* aborted while waiting for the box: nothing was sent to the MCP since the last 503 */
    } finally {
      if (runAbort.current === ac) {
        setRunning(false);
        setRunWaiting(null);
      }
    }
  }

  if (mcps.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          <p>
            No MCP on this server can be tried here yet.
            {disabledCount > 0 &&
              ` ${disabledCount} installed MCP${disabledCount > 1 ? "s are" : " is"} disabled.`}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/servers/${serverId}` as Route}>Back to the server</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const listError = listResponse && !listResponse.ok ? listResponse : null;

  return (
    <div className="space-y-6">
      {(lifecycle === "paused" || lifecycle === "provisioning") && (
        <div className="flex items-start gap-2 border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {lifecycle === "paused"
              ? "This server is paused. The first request wakes it up, which takes about a minute."
              : "This server is still provisioning. The playground retries until it is ready."}
          </p>
        </div>
      )}
      {(lifecycle === "no_runtime" || lifecycle === "error" || lifecycle === "agent_offline") && (
        <div className="flex items-start gap-2 border border-warning/40 border-l-2 border-l-warning bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {lifecycle === "agent_offline"
              ? `The local agent is offline. Run ${localAgentCommand(serverSlug ?? "<server-slug>")} on the machine that hosts these tools.`
              : "This server has no running runtime. Start it from the server page, then come back."}
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
                  <Wrench className="h-4 w-4" />
                </span>
                Tools
              </CardTitle>
              <CardDescription className="pl-12">
                Listing tools is free. It shows what your IDE sees, after the tool policy.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={mcpSlug} onValueChange={setMcpSlug}>
                <SelectTrigger className="w-full sm:w-64" aria-label="MCP">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mcps.map((m) => (
                    <SelectItem key={m.slug} value={m.slug}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => void loadTools()}
                disabled={listLoading}
                title="Reload tools"
                aria-label="Reload tools"
              >
                <RefreshCw className={cn(listLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {mcp?.description && (
            <p className="text-sm italic text-muted-foreground">{mcp.description}</p>
          )}

          <WakingNotice waiting={listWaiting} onCancel={() => listAbort.current?.abort()} />

          {listLoading && !listWaiting && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Listing tools…
            </p>
          )}

          {listError && <ResultPanel response={listError} title="tools/list" />}

          {listResponse?.ok && tools.length === 0 && (
            <p className="text-sm italic text-muted-foreground">
              This MCP exposes no tools
              {listResponse.hiddenByPolicy ? " allowed by its tool policy" : ""}.
            </p>
          )}

          {listResponse?.ok && !!listResponse.hiddenByPolicy && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              {listResponse.hiddenByPolicy} tool{listResponse.hiddenByPolicy > 1 ? "s" : ""} hidden
              by this MCP&apos;s tool policy.
            </p>
          )}

          {tools.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
              {/* Tool index */}
              <div className="space-y-3">
                {tools.length > 6 && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter tools"
                      aria-label="Filter tools"
                      className="pl-9"
                    />
                  </div>
                )}
                <ul className="max-h-[560px] divide-y divide-border overflow-auto border border-border">
                  {visibleTools.map((t) => (
                    <li key={t.name}>
                      <button
                        type="button"
                        onClick={() => setToolName(t.name)}
                        aria-current={t.name === toolName ? "true" : undefined}
                        className={cn(
                          "w-full space-y-1 px-3 py-2.5 text-left transition-colors",
                          t.name === toolName ? "bg-secondary" : "hover:bg-secondary/60"
                        )}
                      >
                        <span className="block break-all font-mono text-xs text-foreground">
                          {t.name}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          <ToolBadges tool={t} />
                        </span>
                      </button>
                    </li>
                  ))}
                  {visibleTools.length === 0 && (
                    <li className="px-3 py-2.5 text-xs italic text-muted-foreground">No match.</li>
                  )}
                </ul>
                <p className="lining text-xs text-muted-foreground">
                  {tools.length} tool{tools.length > 1 ? "s" : ""}
                </p>
              </div>

              {/* Selected tool */}
              {tool && (
                <div className="min-w-0 space-y-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-all font-mono text-sm font-medium">{tool.name}</h2>
                      <ToolBadges tool={tool} />
                    </div>
                    {(tool.title || tool.annotations?.title) && (
                      <p className="text-sm">{tool.title ?? tool.annotations?.title}</p>
                    )}
                    {tool.description ? (
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">No description.</p>
                    )}
                  </div>

                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="smallcaps tracking-sc text-sm font-medium">Arguments</h3>
                      {!form.rawOnly && (
                        <div className="flex items-center gap-1" role="group" aria-label="Editor">
                          {(["form", "json"] as const).map((m) => {
                            const active = (m === "json") === rawMode;
                            return (
                              <button
                                key={m}
                                type="button"
                                aria-pressed={active}
                                onClick={() => (m === "json" ? switchToRaw() : switchToForm())}
                                className={cn(
                                  "smallcaps tracking-sc border px-2.5 py-1 text-xs transition-colors",
                                  active
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {m === "form" ? "Form" : "JSON"}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {rawMode ? (
                      <div className="space-y-1.5">
                        {form.rawOnly && (
                          <p className="text-xs italic text-muted-foreground">
                            This tool&apos;s input schema cannot be shown as a form. Edit the
                            arguments as a JSON object.
                          </p>
                        )}
                        <textarea
                          value={rawText}
                          onChange={(e) => setRawText(e.target.value)}
                          rows={10}
                          spellCheck={false}
                          aria-label="Arguments as JSON"
                          aria-invalid={!!rawError || undefined}
                          disabled={running}
                          className={cn(textareaClass, rawError && "border-destructive")}
                        />
                        {rawError && <p className="text-xs text-destructive">{rawError}</p>}
                      </div>
                    ) : (
                      <ToolForm
                        fields={form.fields}
                        values={values}
                        errors={fieldErrors}
                        disabled={running}
                        onChange={(name, v) => setValues((cur) => ({ ...cur, [name]: v }))}
                      />
                    )}
                  </div>

                  <div className="space-y-2 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={requestRun}
                        disabled={running}
                        variant={needsConfirmation(tool) ? "destructive" : "default"}
                      >
                        {running ? <Loader2 className="animate-spin" /> : <Play />}
                        {running ? "Running…" : "Run tool"}
                      </Button>
                    </div>
                    <p className="text-xs italic text-muted-foreground">
                      Each run is charged as one tool call (
                      <span className="lining not-italic">{CALL_PRICE}</span> from your credit) and
                      appears in your usage, like a call from your IDE.
                    </p>
                  </div>

                  <WakingNotice waiting={runWaiting} onCancel={() => runAbort.current?.abort()} />

                  {runResponse && <ResultPanel response={runResponse} title="tools/call" />}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run a destructive tool?</DialogTitle>
            <DialogDescription>
              <span className="font-mono not-italic">{tool?.name}</span> declares itself
              destructive: it may delete or overwrite data in the service it connects to. It runs
              for real, with the credentials you configured.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void run()}>
              Run anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
