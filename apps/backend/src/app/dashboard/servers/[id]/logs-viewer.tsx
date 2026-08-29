"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pause, Play, RefreshCw, ArrowDownToLine } from "lucide-react";
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

const levelColor: Record<string, string> = {
  error: "text-red-400",
  warn: "text-amber-400",
  info: "text-zinc-200",
  debug: "text-zinc-500",
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

  async function fetchLogs() {
    try {
      const res = await fetch(
        `/api/v2/servers/${serverId}/logs?slug=${encodeURIComponent(slug)}&lines=400`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setError(`Fetch failed: ${res.status}`);
        return;
      }
      const data = (await res.json()) as { lines: LogLine[]; notice?: string; fetchedAt: string };
      setLines(data.lines ?? []);
      setNotice(data.notice ?? null);
      setError(null);
      setLastFetch(new Date(data.fetchedAt).toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
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
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">Logs</CardTitle>
            <CardDescription>
              Live tail · refreshes every {POLL_INTERVAL_MS / 1000}s
              {lastFetch && <span className="ml-2 text-muted-foreground">· last: {lastFetch}</span>}
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
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-3 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </div>
        )}
        <div
          ref={containerRef}
          className="h-[480px] overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-200"
        >
          {loading && lines.length === 0 ? (
            <div className="text-zinc-500">Loading logs…</div>
          ) : lines.length === 0 ? (
            <div className="text-zinc-500">No log lines yet.</div>
          ) : (
            lines.map((l, i) => {
              const level = detectLevel(l.message);
              return (
                <div key={i} className="flex gap-2 leading-5">
                  {l.ts && <span className="text-zinc-500 shrink-0">{l.ts.slice(11, 19)}</span>}
                  {slug === "all" && <span className="text-cyan-400 shrink-0">[{l.source}]</span>}
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
