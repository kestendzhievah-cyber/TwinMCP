"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  Gauge,
  Lock,
  Server,
  type LucideIcon,
} from "lucide-react";
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
import { RangeChips } from "./range-chips";

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

/**
 * Tool calls and errors per day and per MCP, plus API activity. There is no
 * daily quota any more (the prepaid balance is the limit): what usage costs
 * is on the cost section above and on the Credits page.
 */
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
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-10 text-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
          {error || "No data."}
        </p>
        <Button variant="outline" size="sm" onClick={() => load(days)}>
          Retry
        </Button>
      </div>
    );
  }

  const { runtime } = data;
  const today = runtime.daily[runtime.daily.length - 1];
  const todayReq = today?.requests ?? 0;
  const errRate = pctOf(runtime.totals.errors, runtime.totals.requests);
  const empty = runtime.totals.requests === 0 && data.last24h === 0;

  return (
    <div className="space-y-6">
      {/* Range + export. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeChips ranges={RANGES} value={days} onChange={setDays} />
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
              Export CSV · paid credit
            </a>
          </Button>
        )}
      </div>

      {/* Stat tiles: label, figure in the display face, one muted line. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Gauge}
          label="Tool calls today"
          value={fmt(todayReq)}
          note="Since midnight UTC. Each call that reaches your MCP is charged."
        />
        <StatCard
          icon={Activity}
          label={`Tool calls · ${data.days}d`}
          value={fmt(runtime.totals.requests)}
          note={`Across ${runtime.perMcp.length} MCP${runtime.perMcp.length === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={AlertTriangle}
          label={`Error rate · ${data.days}d`}
          value={`${errRate}%`}
          note={`${fmt(runtime.totals.errors)} failed of ${fmt(runtime.totals.requests)}`}
        />
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle as="h2" className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand"
            >
              <Activity className="h-4 w-4" />
            </span>
            Tool calls per day
          </CardTitle>
          <CardDescription className="sm:pl-12">
            Bar height is total tool calls; the red part is errors.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          {empty ? (
            <div className="rounded-xl border-2 border-dashed border-border px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No tool calls yet. Connect an MCP from the{" "}
                <span className="font-medium text-foreground">Marketplace</span> and make a call to
                see it here.
              </p>
            </div>
          ) : (
            <DailyChart daily={runtime.daily} />
          )}
        </CardContent>
      </Card>

      {/* Per-MCP breakdown — a ledger, flush to the card edges. */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle as="h2" className="flex items-center gap-3 tabular-nums">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand"
            >
              <Server className="h-4 w-4" />
            </span>
            By MCP · {data.days}d
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runtime.perMcp.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No tool calls in this window.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5 sm:pl-6">MCP</TableHead>
                    <TableHead className="w-28 text-right">Tool calls</TableHead>
                    <TableHead className="w-24 text-right">Errors</TableHead>
                    <TableHead className="w-28 pr-5 sm:pr-6 text-right">Error rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(showAllMcp ? runtime.perMcp : runtime.perMcp.slice(0, ROW_CAP)).map((m) => (
                    <TableRow key={m.slug}>
                      <TableCell className="pl-5 sm:pl-6">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-medium">{m.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{m.slug}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{fmt(m.requests)}</TableCell>
                      <TableCell className="text-right">{fmt(m.errors)}</TableCell>
                      <TableCell className="pr-5 sm:pr-6 text-right">
                        <Badge
                          variant={pctOf(m.errors, m.requests) > 0 ? "destructive" : "secondary"}
                          className="tabular-nums"
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
                  className="w-full border-t border-border py-3 text-sm font-medium text-brand transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
        <CardHeader className="border-b border-border pb-4">
          <CardTitle as="h2" className="flex items-center gap-3 tabular-nums">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand"
            >
              <Gauge className="h-4 w-4" />
            </span>
            API activity · last 24h
          </CardTitle>
          <CardDescription className="tabular-nums sm:pl-12">
            {fmt(data.last24h)} request{data.last24h === 1 ? "" : "s"} to the TwinMCP API (context &
            library lookups).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.perEndpoint.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No API calls in the last 24 hours.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5 sm:pl-6">Endpoint</TableHead>
                    <TableHead className="w-28 text-right">Requests</TableHead>
                    <TableHead className="w-32 pr-5 sm:pr-6 text-right">Avg latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(showAllEp ? data.perEndpoint : data.perEndpoint.slice(0, ROW_CAP)).map((e) => (
                    <TableRow key={e.endpoint}>
                      <TableCell className="pl-5 sm:pl-6 font-mono text-xs">{e.endpoint}</TableCell>
                      <TableCell className="text-right">{fmt(e.n)}</TableCell>
                      <TableCell className="pr-5 sm:pr-6 text-right">{e.avgLatency} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!showAllEp && data.perEndpoint.length > ROW_CAP && (
                <button
                  type="button"
                  onClick={() => setShowAllEp(true)}
                  className="w-full border-t border-border py-3 text-sm font-medium text-brand transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon aria-hidden className="h-4 w-4 text-brand" />
          {label}
        </p>
        <p className="mt-2 font-display text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

// Daily bars in brand blue on a hairline baseline; the error share in red,
// with a legend so the colour is never the only cue.
function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const max = Math.max(1, ...daily.map((d) => d.requests));
  return (
    <div>
      <div className="flex h-40 items-end gap-px border-b border-border" aria-hidden>
        {daily.map((d) => {
          const h = (d.requests / max) * 100;
          const errPct = d.requests > 0 ? (d.errors / d.requests) * 100 : 0;
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${d.date} · ${d.requests} tool calls, ${d.errors} errors`}
            >
              <div
                className="w-full overflow-hidden rounded-t-sm bg-brand"
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
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
        <span>{daily[0]?.date}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full bg-brand" />
            Tool calls
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full bg-destructive" />
            Errors
          </span>
        </span>
        <span>{daily[daily.length - 1]?.date}</span>
      </div>
    </div>
  );
}
