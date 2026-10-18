"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Download, Gauge, Lock, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DailyPoint {
  date: string;
  requests: number;
  errors: number;
}
interface PerMcp {
  slug: string;
  name: string;
  requests: number;
  errors: number;
}
interface PerEndpoint {
  endpoint: string;
  n: number;
  avgLatency: number;
}
interface UsageData {
  plan: string;
  days: number;
  dailyLimit: number;
  usageExport: boolean;
  last24h: number;
  perEndpoint: PerEndpoint[];
  runtime: {
    totals: { requests: number; errors: number };
    daily: DailyPoint[];
    perMcp: PerMcp[];
  };
}

const RANGES = [7, 30, 90] as const;
const fmt = (n: number) => n.toLocaleString();
const ROW_CAP = 15;
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function UsagePanel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllMcp, setShowAllMcp] = useState(false);
  const [showAllEp, setShowAllEp] = useState(false);

  // Guards against a slow earlier request (e.g. 7d) resolving after a newer one
  // (30d) and clobbering the displayed range with stale numbers.
  const reqId = useRef(0);
  // Cache each range's response so toggling back to a loaded range is instant
  // (served from cache, then refreshed silently in the background).
  const cacheRef = useRef<Map<number, UsageData>>(new Map());
  const load = useCallback(async (d: number) => {
    const id = ++reqId.current;
    const cached = cacheRef.current.get(d);
    if (cached) {
      setData(cached);
      setError("");
      setLoading(false);
    } else {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch(`/api/v2/usage?days=${d}`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as UsageData;
      cacheRef.current.set(d, json);
      if (id === reqId.current) setData(json);
    } catch {
      if (id === reqId.current && !cached) setError("Could not load usage. Try again.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border border-dashed border-foreground/40 px-6 py-10 text-center">
        <p className="text-sm italic text-muted-foreground">
          {error || "No data."}{" "}
          <button
            type="button"
            className="not-italic text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
            onClick={() => load(days)}
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  const { runtime } = data;
  const today = runtime.daily[runtime.daily.length - 1];
  const todayReq = today?.requests ?? 0;
  const limitPct = Math.min(100, pctOf(todayReq, data.dailyLimit));
  const errRate = pctOf(runtime.totals.errors, runtime.totals.requests);
  const empty = runtime.totals.requests === 0 && data.last24h === 0;

  return (
    <div className="space-y-6">
      {/* Range + export: hairline stamps for the window, the chosen one pressed in ink. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Range"
          className="inline-flex divide-x divide-border border border-border bg-card"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={cn(
                "lining h-10 px-4 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:translate-y-px",
                days === r
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}d
            </button>
          ))}
        </div>
        {data.usageExport ? (
          <Button asChild variant="outline">
            <a href={`/api/v2/usage/export?days=${days}`} download>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <a href="/dashboard/billing">
              <Lock className="h-4 w-4" />
              Export CSV · Pro
            </a>
          </Button>
        )}
      </div>

      {/* Stat cards (DESIGN.md §5): small-caps caption, lining number, italic footnote. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="smallcaps tracking-sc flex items-center gap-2 text-xs not-italic">
              <Gauge className="h-4 w-4" />
              MCP requests today
            </CardDescription>
            <CardTitle className="lining text-3xl">
              {fmt(todayReq)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {fmt(data.dailyLimit)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-1.5 w-full bg-secondary">
              <div
                className={cn(
                  "h-full transition-all",
                  limitPct >= 100
                    ? "bg-destructive"
                    : limitPct >= 80
                      ? "bg-warning"
                      : "bg-foreground"
                )}
                style={{ width: `${limitPct}%` }}
              />
            </div>
            <p className="lining mt-2 text-xs italic text-muted-foreground">
              {limitPct}% of your daily limit used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="smallcaps tracking-sc flex items-center gap-2 text-xs not-italic">
              <Activity className="h-4 w-4" />
              MCP requests · {data.days}d
            </CardDescription>
            <CardTitle className="lining text-3xl">{fmt(runtime.totals.requests)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="lining text-xs italic text-muted-foreground">
              Across {runtime.perMcp.length} MCP{runtime.perMcp.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="smallcaps tracking-sc flex items-center gap-2 text-xs not-italic">
              <AlertTriangle className="h-4 w-4" />
              Error rate · {data.days}d
            </CardDescription>
            <CardTitle className="lining text-3xl">{errRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="lining text-xs italic text-muted-foreground">
              {fmt(runtime.totals.errors)} failed of {fmt(runtime.totals.requests)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
              <Activity className="h-4 w-4" />
            </span>
            Requests per day
          </CardTitle>
          <CardDescription className="pl-12">
            Bar height is total requests; the red portion is errors.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {empty ? (
            <div className="border border-dashed border-foreground/40 px-6 py-8 text-center">
              <p className="text-sm italic text-muted-foreground">
                No requests yet. Connect an MCP from the{" "}
                <span className="font-medium not-italic">Marketplace</span> and make a call to see
                it here.
              </p>
            </div>
          ) : (
            <DailyChart daily={runtime.daily} />
          )}
        </CardContent>
      </Card>

      {/* Per-MCP breakdown — a ledger, flush to the card edges. */}
      <Card>
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="lining flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
              <Server className="h-4 w-4" />
            </span>
            By MCP · {data.days}d
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runtime.perMcp.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm italic text-muted-foreground">
              No MCP traffic in this window.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">MCP</TableHead>
                    <TableHead className="w-28 text-right">Requests</TableHead>
                    <TableHead className="w-24 text-right">Errors</TableHead>
                    <TableHead className="w-28 pr-6 text-right">Error rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(showAllMcp ? runtime.perMcp : runtime.perMcp.slice(0, ROW_CAP)).map((m) => (
                    <TableRow key={m.slug}>
                      <TableCell className="pl-6">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-medium">{m.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{m.slug}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{fmt(m.requests)}</TableCell>
                      <TableCell className="text-right">{fmt(m.errors)}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <Badge
                          variant={pctOf(m.errors, m.requests) > 0 ? "destructive" : "secondary"}
                          className="lining"
                        >
                          {pctOf(m.errors, m.requests)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!showAllMcp && runtime.perMcp.length > ROW_CAP && (
                <button
                  type="button"
                  onClick={() => setShowAllMcp(true)}
                  className="smallcaps tracking-sc lining w-full border-t border-border py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                >
                  Show all {runtime.perMcp.length}
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* API activity (24h) */}
      <Card>
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="lining flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
              <Gauge className="h-4 w-4" />
            </span>
            API activity · last 24h
          </CardTitle>
          <CardDescription className="lining pl-12">
            {fmt(data.last24h)} request{data.last24h === 1 ? "" : "s"} to the TwinMCP API (context &
            library lookups).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.perEndpoint.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm italic text-muted-foreground">
              No API calls in the last 24 hours.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Endpoint</TableHead>
                    <TableHead className="w-28 text-right">Requests</TableHead>
                    <TableHead className="w-32 pr-6 text-right">Avg latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(showAllEp ? data.perEndpoint : data.perEndpoint.slice(0, ROW_CAP)).map((e) => (
                    <TableRow key={e.endpoint}>
                      <TableCell className="pl-6 font-mono text-xs">{e.endpoint}</TableCell>
                      <TableCell className="text-right">{fmt(e.n)}</TableCell>
                      <TableCell className="pr-6 text-right">{e.avgLatency} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!showAllEp && data.perEndpoint.length > ROW_CAP && (
                <button
                  type="button"
                  onClick={() => setShowAllEp(true)}
                  className="smallcaps tracking-sc lining w-full border-t border-border py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                >
                  Show all {data.perEndpoint.length}
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Ink bars on a hairline baseline — a ledger chart, no rounding, no fills.
function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const max = Math.max(1, ...daily.map((d) => d.requests));
  return (
    <div>
      <div className="flex h-40 items-end gap-px border-b border-foreground/50">
        {daily.map((d) => {
          const h = (d.requests / max) * 100;
          const errPct = d.requests > 0 ? (d.errors / d.requests) * 100 : 0;
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${d.date} · ${d.requests} requests, ${d.errors} errors`}
            >
              <div className="w-full overflow-hidden bg-foreground/80" style={{ height: `${h}%` }}>
                {errPct > 0 && (
                  <div className="w-full bg-destructive" style={{ height: `${errPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="lining mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{daily[0]?.date}</span>
        <span>{daily[daily.length - 1]?.date}</span>
      </div>
    </div>
  );
}
