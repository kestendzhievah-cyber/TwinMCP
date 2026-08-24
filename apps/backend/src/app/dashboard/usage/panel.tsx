"use client";

import { useCallback, useEffect, useState } from "react";
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
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function UsagePanel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v2/usage?days=${d}`);
      if (!res.ok) throw new Error();
      setData((await res.json()) as UsageData);
    } catch {
      setError("Could not load usage. Try again.");
    } finally {
      setLoading(false);
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
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error || "No data."}{" "}
          <button className="underline" onClick={() => load(days)}>
            Retry
          </button>
        </CardContent>
      </Card>
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
      {/* Range + export controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border/80 bg-card p-1 text-sm">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={`rounded-full px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                days === r
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
        {data.usageExport ? (
          <Button asChild variant="outline" size="sm">
            <a href={`/api/v2/usage/export?days=${days}`} download>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <a href="/dashboard/billing">
              <Lock className="h-3.5 w-3.5" />
              Export CSV · Pro
            </a>
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" /> MCP requests today
            </CardDescription>
            <CardTitle className="text-2xl">
              {fmt(todayReq)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {fmt(data.dailyLimit)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full transition-all ${limitPct >= 100 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${limitPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {limitPct}% of your daily limit used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> MCP requests · {data.days}d
            </CardDescription>
            <CardTitle className="text-2xl">{fmt(runtime.totals.requests)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {runtime.perMcp.length} MCP{runtime.perMcp.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Error rate · {data.days}d
            </CardDescription>
            <CardTitle className="text-2xl">{errRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {fmt(runtime.totals.errors)} failed of {fmt(runtime.totals.requests)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests per day</CardTitle>
          <CardDescription>
            Bar height is total requests; the red portion is errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {empty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No requests yet. Connect an MCP from the{" "}
              <span className="font-medium">Marketplace</span> and make a call to see it here.
            </p>
          ) : (
            <DailyChart daily={runtime.daily} />
          )}
        </CardContent>
      </Card>

      {/* Per-MCP breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By MCP · {data.days}d</CardTitle>
        </CardHeader>
        <CardContent>
          {runtime.perMcp.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MCP traffic in this window.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MCP</TableHead>
                    <TableHead className="w-28 text-right">Requests</TableHead>
                    <TableHead className="w-24 text-right">Errors</TableHead>
                    <TableHead className="w-24 text-right">Error rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runtime.perMcp.map((m) => (
                    <TableRow key={m.slug}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{m.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{m.slug}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(m.requests)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(m.errors)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={pctOf(m.errors, m.requests) > 0 ? "destructive" : "secondary"}
                        >
                          {pctOf(m.errors, m.requests)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API activity (24h) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API activity · last 24h</CardTitle>
          <CardDescription>
            {fmt(data.last24h)} request{data.last24h === 1 ? "" : "s"} to the TwinMCP API (context &
            library lookups).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.perEndpoint.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API calls in the last 24 hours.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="w-28 text-right">Requests</TableHead>
                    <TableHead className="w-32 text-right">Avg latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.perEndpoint.map((e) => (
                    <TableRow key={e.endpoint}>
                      <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(e.n)}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.avgLatency} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const max = Math.max(1, ...daily.map((d) => d.requests));
  return (
    <div>
      <div className="flex h-40 items-end gap-px">
        {daily.map((d) => {
          const h = (d.requests / max) * 100;
          const errPct = d.requests > 0 ? (d.errors / d.requests) * 100 : 0;
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${d.date} · ${d.requests} requests, ${d.errors} errors`}
            >
              <div
                className="w-full overflow-hidden rounded-t-sm bg-primary/80"
                style={{ height: `${h}%` }}
              >
                {errPct > 0 && (
                  <div className="w-full bg-destructive" style={{ height: `${errPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{daily[0]?.date}</span>
        <span>{daily[daily.length - 1]?.date}</span>
      </div>
    </div>
  );
}
