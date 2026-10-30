"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Lock, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CustomerUsageRow } from "@/lib/usage/customers";

interface CustomersData {
  from: string;
  to: string;
  retentionDays: number;
  clamped: boolean;
  usageExport: boolean;
  truncated: boolean;
  rows: CustomerUsageRow[];
}
interface ServerItem {
  id: string;
  name: string;
}

const RANGES = [7, 30, 90] as const;
const ALL = "all";
const ROW_CAP = 15;
const DAY_MS = 86_400_000;
const fmt = (n: number) => n.toLocaleString();
const day = (iso: string) => iso.slice(0, 10);

function query(from: string, to: string | null, serverId: string, csv = false): string {
  const p = new URLSearchParams({ from });
  if (to) p.set("to", to);
  if (serverId !== ALL) p.set("serverId", serverId);
  if (csv) p.set("format", "csv");
  return `/api/v2/usage/customers?${p.toString()}`;
}

/**
 * "By end customer": tool calls grouped by the end-customer id set on the API
 * key that made them (agencies issuing one MCP-proxy key per customer). Calls
 * from unlabelled keys get one row per key.
 */
export function CustomersSection() {
  const [days, setDays] = useState<number>(30);
  const [serverId, setServerId] = useState<string>(ALL);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [data, setData] = useState<CustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/v2/servers")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items?: ServerItem[] }) => {
        if (alive) setServers((j.items ?? []).map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async (d: number, srv: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const from = new Date(Date.now() - d * DAY_MS).toISOString();
      const res = await fetch(query(from, null, srv));
      if (!res.ok) throw new Error();
      const json = (await res.json()) as CustomersData;
      if (id === reqId.current) setData(json);
    } catch {
      if (id === reqId.current) setError("Could not load usage by end customer. Try again.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days, serverId);
  }, [days, serverId, load]);

  const rows = data?.rows ?? [];
  const retention = data?.retentionDays;

  // A range longer than the plan keeps is disabled: fall back to the longest one
  // that fits (Free keeps 7 days).
  useEffect(() => {
    if (retention === undefined || days <= retention) return;
    const fit = [...RANGES].reverse().find((r) => r <= retention);
    if (fit) setDays(fit);
  }, [retention, days]);

  return (
    <Card>
      <CardHeader className="border-b border-border px-6 py-4">
        <CardTitle className="lining flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
            <Users className="h-4 w-4" />
          </span>
          By end customer
        </CardTitle>
        <CardDescription className="pl-12">
          Tool calls per end customer, from the end customer id set on an MCP-proxy key (
          <Link
            href="/dashboard"
            className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
          >
            API keys
          </Link>
          ). Calls from keys without one get a row per key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Range"
              className="inline-flex divide-x divide-border border border-border bg-card"
            >
              {RANGES.map((r) => {
                const beyond = retention !== undefined && r > retention;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDays(r)}
                    aria-pressed={days === r}
                    disabled={beyond}
                    title={beyond ? `Your plan keeps ${retention} days of activity` : undefined}
                    className={cn(
                      "lining h-10 px-4 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
                      days === r
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r}d
                  </button>
                );
              })}
            </div>
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger className="h-10 w-56" aria-label="Server">
                <SelectValue placeholder="All servers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All servers</SelectItem>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {data &&
            (data.usageExport ? (
              <Button asChild variant="outline">
                <a href={query(data.from, data.to, serverId, true)} download>
                  <Download className="h-4 w-4" />
                  Download CSV
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <a href="/dashboard/billing">
                  <Lock className="h-4 w-4" />
                  Download CSV · paid credit
                </a>
              </Button>
            ))}
        </div>

        {data && (
          <p className="lining text-xs italic text-muted-foreground">
            {day(data.from)} to {day(data.to)} (UTC). Your account keeps {data.retentionDays} days
            of tool-call activity, so this table covers at most the last {data.retentionDays} days
            {data.clamped ? "; the range was shortened to fit" : ""}. Errors include denied and
            rate-limited calls.
          </p>
        )}

        {loading && !data ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <p className="border border-dashed border-foreground/40 px-6 py-8 text-center text-sm italic text-muted-foreground">
            {error}{" "}
            <button
              type="button"
              className="not-italic text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
              onClick={() => load(days, serverId)}
            >
              Retry
            </button>
          </p>
        ) : rows.length === 0 ? (
          <p className="border border-dashed border-foreground/40 px-6 py-8 text-center text-sm italic text-muted-foreground">
            No tool calls in this window.
          </p>
        ) : (
          <div className={cn("-mx-6 border-t border-border", loading && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">End customer</TableHead>
                  <TableHead>API key</TableHead>
                  <TableHead className="w-28 text-right">Tool calls</TableHead>
                  <TableHead className="w-24 text-right">Errors</TableHead>
                  <TableHead className="w-44 pr-6 text-right">Last call (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(showAll ? rows : rows.slice(0, ROW_CAP)).map((r, i) => (
                  <TableRow key={`${r.externalUserId ?? ""}|${r.apiKeyPrefix ?? ""}|${i}`}>
                    <TableCell className="max-w-[16rem] pl-6">
                      {r.externalUserId ? (
                        <span className="block truncate font-mono text-xs" title={r.externalUserId}>
                          {r.externalUserId}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          No end customer
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.apiKeyPrefix ? (
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-mono text-xs">{r.apiKeyPrefix}…</span>
                          {r.apiKeyName && (
                            <span className="text-xs text-muted-foreground">{r.apiKeyName}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          {r.externalUserId
                            ? "Several keys"
                            : "Deleted key, OAuth connector or Playground"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="lining text-right">{fmt(r.calls)}</TableCell>
                    <TableCell className="lining text-right">{fmt(r.errors)}</TableCell>
                    <TableCell className="lining pr-6 text-right text-xs text-muted-foreground">
                      {r.lastCallAt ? r.lastCallAt.slice(0, 16).replace("T", " ") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!showAll && rows.length > ROW_CAP && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="smallcaps tracking-sc lining w-full border-t border-border py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              >
                Show all {rows.length}
              </button>
            )}
            {data?.truncated && (
              <p className="border-t border-border px-6 py-2.5 text-xs italic text-muted-foreground">
                Showing the {fmt(rows.length)} busiest rows.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
