"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ArrowDownToLine, Pause, Play, RefreshCw, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogLine {
  ts: string | null;
  source: string;
  message: string;
}

interface InstalledOption {
  slug: string;
  name: string;
}

const POLL_INTERVAL_MS = 2000;

function detectLevel(message: string): "error" | "warn" | "info" | "debug" {
  const low = message.toLowerCase();
  if (/\b(error|err|fatal|fail(ed)?|exception|panic)\b/.test(low)) return "error";
  if (/\b(warn|warning|deprecated)\b/.test(low)) return "warn";
  if (/\bdebug\b/.test(low)) return "debug";
  return "info";
}

// Levels on ink stock (DESIGN.md §5 logs viewer): the panel carries the `dark`
// class so these tokens resolve to bone, ochre and oxblood on ink.
const levelColor: Record<string, string> = {
  error: "text-destructive",
  warn: "text-warning",
  info: "text-foreground",
  debug: "text-muted-foreground",
};

export function LogsViewer({
  serverId,
  installed,
}: {
  serverId: string;
  installed: InstalledOption[];
}) {
  const [slug, setSlug] = useState<string>("all");
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  // Ignore a stale in-flight response (e.g. after switching the MCP filter) so it
  // can't overwrite the newer request's logs.
  const reqId = useRef(0);

  async function fetchLogs() {
    const id = ++reqId.current;
    try {
      const res = await fetch(
        `/api/v2/servers/${serverId}/logs?slug=${encodeURIComponent(slug)}&lines=400`,
        { cache: "no-store" }
      );
      if (id !== reqId.current) return;
      if (!res.ok) {
        setError(`Fetch failed: ${res.status}`);
        return;
      }
      const data = (await res.json()) as { lines: LogLine[]; notice?: string; fetchedAt: string };
      if (id !== reqId.current) return;
      setLines(data.lines ?? []);
      setNotice(data.notice ?? null);
      setError(null);
      setLastFetch(new Date(data.fetchedAt).toLocaleTimeString());
    } catch (err) {
      if (id === reqId.current) setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    if (paused) return;
    const interval = setInterval(() => {
      // Don't poll a background tab — saves battery and requests.
      if (typeof document !== "undefined" && document.hidden) return;
      fetchLogs();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, slug, paused]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  return (
    <Card>
      {/* Ruled header: hairline icon square + small-caps title; the tail controls share the row. */}
      <CardHeader className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
                  <ScrollText className="h-4 w-4" />
                </span>
                Logs
              </CardTitle>
              {paused && <Badge variant="warning">Paused</Badge>}
            </div>
            <CardDescription className="lining pl-12">
              Live tail · refreshes every {POLL_INTERVAL_MS / 1000}s
              {lastFetch && <span> · last: {lastFetch}</span>}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All MCPs (combined)</SelectItem>
                {installed.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setPaused((p) => !p)}
              title={paused ? "Resume" : "Pause"}
              aria-label={paused ? "Resume live tail" : "Pause live tail"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={fetchLogs}
              title="Refresh now"
              aria-label="Refresh logs now"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={autoScroll ? "default" : "outline"}
              onClick={() => setAutoScroll((a) => !a)}
              title="Auto-scroll to bottom"
              aria-label="Auto-scroll to bottom"
              aria-pressed={autoScroll}
            >
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {(error || notice) && (
          <div className="space-y-3 border-b border-border px-6 py-4">
            {error && (
              <div className="flex items-start gap-2 border border-destructive/40 border-l-2 border-l-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
                {notice}
              </div>
            )}
          </div>
        )}
        {/* Ink stock: `dark` flips the tokens locally so the tail reads as bone
            type on ink, in both themes (DESIGN.md §1, §5). The panel runs flush
            to the card's hairline, a window cut into the stock. */}
        <div
          ref={containerRef}
          className="dark h-[480px] overflow-auto bg-background p-4 font-mono text-xs text-foreground"
        >
          {loading && lines.length === 0 ? (
            <div className="text-muted-foreground">Loading logs…</div>
          ) : lines.length === 0 ? (
            <div className="text-muted-foreground">No log lines yet.</div>
          ) : (
            lines.map((l, i) => {
              const level = detectLevel(l.message);
              return (
                <div key={i} className="flex gap-3 leading-5">
                  {l.ts && (
                    <span className="shrink-0 text-muted-foreground">{l.ts.slice(11, 19)}</span>
                  )}
                  {slug === "all" && <span className="shrink-0 text-info">[{l.source}]</span>}
                  <span className={cn("whitespace-pre-wrap break-all", levelColor[level])}>
                    {l.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
