"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Activity, Boxes, CreditCard, Download, RefreshCw, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { DENSE_TABLE, EmptyNote, ErrorNotice, StatTile } from "../admin-ui";

type Plan = "free" | "pro" | "team";

interface ClientRow {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  subscriptionStatus: string | null;
  createdAt: string;
  servers: number;
  serversRunning: number;
  serversError: number;
  mcps: number;
  mcpRequests30d: number;
  mrr: number;
  /** Wallet balance in euros (paid + unexpired promo); <= 0 means calls are refused. */
  balanceEur: number;
  crmStatus: string | null;
  health: string;
}

// Health dots use the semantic tints only (DESIGN.md §1 / §4.9), never a palette colour.
const HEALTH_COLOR: Record<string, string> = {
  healthy: "bg-success",
  at_risk: "bg-warning",
  critical: "bg-destructive",
  inactive: "bg-muted-foreground/40",
  new: "bg-info",
};
const HEALTH_LABEL: Record<string, string> = {
  healthy: "En bonne santé",
  at_risk: "À risque",
  critical: "Critique",
  inactive: "Inactif",
  new: "Nouveau",
};

interface Payload {
  clients: ClientRow[];
  totals: { count: number; paying: number; runningServers: number; mrr: number };
}

const nf = new Intl.NumberFormat("fr-FR");
const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
// users.plan since the wallet: "pro" = funded (a first paid top-up), "free" = free credit only.
const PLAN_LABEL: Record<Plan, string> = {
  free: "Non financé",
  pro: "Financé",
  team: "Team (ancien)",
};
const planVariant = (p: Plan): "secondary" | "success" => (p === "free" ? "secondary" : "success");

export function ClientsPanel() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [zeroOnly, setZeroOnly] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v2/admin/clients", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Payload);
      setError("");
    } catch {
      setError("Impossible de charger les clients.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.clients ?? [];
    const rows = zeroOnly ? all.filter((c) => c.balanceEur <= 0) : all;
    if (!q) return rows;
    return rows.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.name?.toLowerCase().includes(q) ?? false)
    );
  }, [data, query, zeroOnly]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorNotice onRetry={() => void load()}>{error}</ErrorNotice>;
  }

  const totals = data?.totals ?? { count: 0, paying: 0, runningServers: 0, mrr: 0 };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Users />} label="Clients" value={nf.format(totals.count)} />
        <StatTile icon={<CreditCard />} label="Payants" value={nf.format(totals.paying)} />
        <StatTile
          icon={<Boxes />}
          label="Serveurs actifs"
          value={nf.format(totals.runningServers)}
        />
        <StatTile
          icon={<Activity />}
          label="Recharges nettes 30 j"
          value={eur.format(totals.mrr)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un client (email, nom)…"
              aria-label="Rechercher un client"
              className="pl-9"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* A filter toggle: selected = brand tint (never rose). */}
            <Button
              variant="outline"
              aria-pressed={zeroOnly}
              onClick={() => setZeroOnly((v) => !v)}
              className={cn(
                zeroOnly &&
                  "border-brand bg-brand/10 text-brand hover:border-brand hover:bg-brand/15"
              )}
            >
              Solde nul
            </Button>
            {/* CSV of Free users for an upgrade campaign (merge fields of the email). */}
            <Button asChild variant="outline">
              <a href="/api/v2/admin/clients/export?plan=free" download>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exporter les Free</span>
                <span className="sm:hidden">CSV</span>
              </a>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={refreshing}
              aria-label="Rafraîchir"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyNote icon={<Search />}>Aucun client ne correspond.</EmptyNote>
        ) : (
          <Card className="overflow-hidden">
            <Table className={DENSE_TABLE}>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Client</TableHead>
                  <TableHead className="w-20">Plan</TableHead>
                  <TableHead className="w-28 text-right">Serveurs</TableHead>
                  <TableHead className="w-20 text-right">MCPs</TableHead>
                  <TableHead
                    className="w-28 text-right"
                    title="Appels d’outils (tools/call) sur 30 jours"
                  >
                    Appels 30j
                  </TableHead>
                  <TableHead className="w-24 text-right">Solde</TableHead>
                  <TableHead
                    className="w-24 pr-6 text-right"
                    title="Recharges payées sur 30 jours, nettes des remboursements et litiges"
                  >
                    Recharges 30 j
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer focus-visible:bg-accent focus-visible:outline-none"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/admin/clients/${c.id}` as Route)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        router.push(`/dashboard/admin/clients/${c.id}` as Route);
                      }
                    }}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 shrink-0 rounded-full",
                            HEALTH_COLOR[c.health] ?? "bg-muted-foreground/40"
                          )}
                          title={`Santé : ${HEALTH_LABEL[c.health] ?? c.health}`}
                          aria-hidden
                        />
                        <span className="sr-only">
                          Santé : {HEALTH_LABEL[c.health] ?? c.health}.
                        </span>
                        <span className="font-semibold">{c.name || c.email}</span>
                        {c.crmStatus === "won" && <Badge variant="success">Client gagné</Badge>}
                      </div>
                      {c.name && (
                        <div className="pl-4 text-xs text-muted-foreground">{c.email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={planVariant(c.plan)}>{PLAN_LABEL[c.plan]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(c.serversError > 0 && "text-destructive")}>
                        {c.serversRunning}/{c.servers}
                      </span>
                      {c.serversError > 0 && (
                        <span className="ml-1 text-xs text-destructive">
                          ({c.serversError} err)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c.mcps}</TableCell>
                    <TableCell className="text-right">{nf.format(c.mcpRequests30d)}</TableCell>
                    <TableCell
                      className={cn("text-right", c.balanceEur <= 0 && "text-destructive")}
                    >
                      {eur2.format(c.balanceEur)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {c.mrr !== 0 ? eur.format(c.mrr) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
