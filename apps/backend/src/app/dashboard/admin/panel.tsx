"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Boxes,
  CreditCard,
  RefreshCw,
  Server,
  Users,
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
import { cn } from "@/lib/utils";

interface Point {
  date: string;
  value: number;
}
interface EndpointRow {
  endpoint: string;
  n: number;
  errors: number;
  avgLatency: number;
}
interface SignupRow {
  email: string;
  plan: string;
  createdAt: string;
}
interface ActivityRow {
  action: string;
  targetType: string;
  email: string | null;
  createdAt: string;
}
interface AdminStats {
  generatedAt: string;
  users: {
    total: number;
    byPlan: { free: number; pro: number; team: number };
    new7d: number;
    new30d: number;
    paying: number;
  };
  revenue: { mrrEstimate: number; currency: string; payingUsers: number };
  servers: { total: number; byStatus: Record<string, number>; running: number; new7d: number };
  traffic: {
    api24h: number;
    apiErrors24h: number;
    apiAvgLatency24h: number;
    api7d: number;
    mcpRequests7d: number;
    mcpErrors7d: number;
    topEndpoints: EndpointRow[];
  };
  catalog: { mcpServers: number; communityMcps: number; libraries: number; activeApiKeys: number };
  series: { signups30d: Point[]; api14d: Point[] };
  recentSignups: SignupRow[];
  recentActivity: ActivityRow[];
}

const REFRESH_MS = 15_000;
const fmt = (n: number) => n.toLocaleString();
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function relTime(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Owns its own 1s tick so a relative timestamp stays live WITHOUT re-rendering
// the whole analytics panel (6 KPI cards + 2 charts + 2 tables) every second.
function RelTime({ iso }: { iso: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{relTime(iso, Date.now())}</>;
}

export function AdminAnalyticsPanel() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v2/admin/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as AdminStats);
      setError("");
    } catch {
      setError("Could not load stats.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Poll on an interval, but pause while the tab is hidden (no point hammering
  // the DB for a screen nobody is looking at) and refetch immediately on return.
  useEffect(() => {
    void load();
    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(() => void load(), REFRESH_MS);
    };
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        void load();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {error}{" "}
          <button
            className="underline decoration-destructive/40 underline-offset-4 hover:decoration-destructive"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { users, revenue, servers, traffic, catalog, series } = data;
  const errRate24 = pctOf(traffic.apiErrors24h, traffic.api24h);

  return (
    <div className="space-y-6">
      {/* Live status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success" />
          <span className="smallcaps tracking-sc font-medium text-foreground">Live</span>
          <span>·</span>
          <span className="lining italic">
            updated <RelTime iso={data.generatedAt} />
          </span>
        </p>
        <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Total users"
          value={fmt(users.total)}
          sub={`+${fmt(users.new7d)} in 7d · +${fmt(users.new30d)} in 30d`}
        />
        <Kpi
          icon={<CreditCard className="h-4 w-4" />}
          label="Paying users · MRR (est.)"
          value={`${fmt(users.paying)} · €${revenue.mrrEstimate.toLocaleString()}`}
          sub={`${users.byPlan.pro} Pro · ${users.byPlan.team} Team`}
        />
        <Kpi
          icon={<Server className="h-4 w-4" />}
          label="Servers running"
          value={`${fmt(servers.running)} / ${fmt(servers.total)}`}
          sub={`+${fmt(servers.new7d)} new in 7d`}
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="API requests · 24h"
          value={fmt(traffic.api24h)}
          sub={`${fmt(traffic.api7d)} in 7d · ${traffic.apiAvgLatency24h}ms avg`}
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          label="API error rate · 24h"
          value={`${errRate24}%`}
          sub={`${fmt(traffic.apiErrors24h)} failed of ${fmt(traffic.api24h)}`}
        />
        <Kpi
          icon={<Boxes className="h-4 w-4" />}
          label="MCP runtime req · 7d"
          value={fmt(traffic.mcpRequests7d)}
          sub={`${fmt(traffic.mcpErrors7d)} errors · ${catalog.mcpServers} MCPs, ${catalog.communityMcps} community`}
        />
      </div>

      {/* Trend charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">Signups · 30d</CardTitle>
            <CardDescription>New users per day (UTC).</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <MiniBars points={series.signups30d} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">API requests · 14d</CardTitle>
            <CardDescription>Requests to the TwinMCP API per day (UTC).</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <MiniBars points={series.api14d} />
          </CardContent>
        </Card>
      </div>

      {/* Plan + server status breakdown */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">Users by plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              <li className="flex items-center justify-between gap-3 py-2.5">
                <Badge variant="secondary">Free</Badge>
                <span className="lining font-medium">{fmt(users.byPlan.free)}</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2.5">
                <Badge variant="success">Pro</Badge>
                <span className="lining font-medium">{fmt(users.byPlan.pro)}</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2.5">
                <Badge variant="success">Team</Badge>
                <span className="lining font-medium">{fmt(users.byPlan.team)}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">Servers by status</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(servers.byStatus).length === 0 ? (
              <p className="py-2.5 text-sm italic text-muted-foreground">No servers yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {Object.entries(servers.byStatus).map(([status, n]) => (
                  <li key={status} className="flex items-center justify-between gap-3 py-2.5">
                    <Badge
                      variant={
                        status === "running"
                          ? "success"
                          : status === "provisioning"
                            ? "warning"
                            : status === "error"
                              ? "destructive"
                              : status === "destroyed"
                                ? "outline"
                                : "secondary"
                      }
                    >
                      {status}
                    </Badge>
                    <span className="lining font-medium">{fmt(n)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top endpoints (24h) */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">Top API endpoints · 24h</CardTitle>
        </CardHeader>
        <CardContent>
          {traffic.topEndpoints.length === 0 ? (
            <p className="py-2.5 text-sm italic text-muted-foreground">
              No API calls in the last 24 hours.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="w-24 text-right">Requests</TableHead>
                  <TableHead className="w-20 text-right">Errors</TableHead>
                  <TableHead className="w-28 text-right">Avg latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {traffic.topEndpoints.map((e) => (
                  <TableRow key={e.endpoint}>
                    <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                    <TableCell className="text-right">{fmt(e.n)}</TableCell>
                    <TableCell className="text-right">{fmt(e.errors)}</TableCell>
                    <TableCell className="text-right">{e.avgLatency} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent signups + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">Recent signups</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentSignups.length === 0 ? (
              <p className="py-2.5 text-sm italic text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.recentSignups.map((u, i) => (
                  <li
                    key={`${u.email}-${i}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="truncate font-mono text-xs">{u.email}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={u.plan === "free" ? "secondary" : "success"}>{u.plan}</Badge>
                      <span className="lining text-xs text-muted-foreground">
                        <RelTime iso={u.createdAt} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="py-2.5 text-sm italic text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.recentActivity.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate">
                      <span className="font-medium">{a.action}</span>{" "}
                      <span className="text-muted-foreground">{a.targetType}</span>
                      {a.email && (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          · {a.email}
                        </span>
                      )}
                    </span>
                    <span className="lining shrink-0 text-xs text-muted-foreground">
                      <RelTime iso={a.createdAt} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// A stat card from the brief: small-caps caption with a bare icon, the figure
// in lining numerals, one muted line of context under it.
function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="smallcaps tracking-sc flex items-center gap-2 text-xs not-italic">
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          {label}
        </CardDescription>
        <CardTitle className="lining text-3xl">{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent>
          <p className="lining text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      )}
    </Card>
  );
}

// Ink bars on a hairline baseline — a ledger chart, no rounding, no fills.
function MiniBars({ points }: { points: Point[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm italic text-muted-foreground">
        No data in this window.
      </p>
    );
  }
  return (
    <div>
      <div className="flex h-32 items-end gap-px border-b border-foreground/50">
        {points.map((p) => (
          <div
            key={p.date}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${p.date} · ${p.value}`}
          >
            <div
              className="w-full bg-foreground/80"
              style={{ height: `${(p.value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="lining mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}
