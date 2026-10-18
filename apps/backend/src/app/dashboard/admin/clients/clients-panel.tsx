"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Activity, AlertCircle, Boxes, CreditCard, RefreshCw, Search, Users } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };
const planVariant = (p: Plan): "secondary" | "success" => (p === "free" ? "secondary" : "success");

export function ClientsPanel() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

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
    const rows = data?.clients ?? [];
    if (!q) return rows;
    return rows.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.name?.toLowerCase().includes(q) ?? false)
    );
  }, [data, query]);

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
    return (
      <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {error}{" "}
          <button
            className="smallcaps tracking-sc font-medium underline decoration-destructive/40 underline-offset-4 hover:decoration-destructive"
            onClick={() => void load()}
          >
            Réessayer
          </button>
        </p>
      </div>
    );
  }

  const totals = data?.totals ?? { count: 0, paying: 0, runningServers: 0, mrr: 0 };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Users className="h-4 w-4" />} label="Clients" value={nf.format(totals.count)} />
        <Kpi
          icon={<CreditCard className="h-4 w-4" />}
          label="Payants"
          value={nf.format(totals.paying)}
        />
        <Kpi
          icon={<Boxes className="h-4 w-4" />}
          label="Serveurs actifs"
          value={nf.format(totals.runningServers)}
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="MRR estimé"
          value={eur.format(totals.mrr)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un client (email, nom)…"
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="border border-dashed border-foreground/40 px-6 py-10 text-center">
            <Search className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-sm italic text-muted-foreground">Aucun client ne correspond.</p>
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Client</TableHead>
                  <TableHead className="w-20">Plan</TableHead>
                  <TableHead className="w-28 text-right">Serveurs</TableHead>
                  <TableHead className="w-20 text-right">MCPs</TableHead>
                  <TableHead className="w-28 text-right">Req. 30j</TableHead>
                  <TableHead className="w-24 pr-6 text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/admin/clients/${c.id}` as Route)}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 shrink-0 rounded-full",
                            HEALTH_COLOR[c.health] ?? "bg-muted-foreground/40"
                          )}
                          title={`Santé : ${HEALTH_LABEL[c.health] ?? c.health}`}
                        />
                        <span className="font-medium">{c.name || c.email}</span>
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
                    <TableCell className="pr-6 text-right">
                      {c.mrr > 0 ? eur.format(c.mrr) : "—"}
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

// Stat card (DESIGN.md §5): small-caps caption, lining number.
function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="smallcaps tracking-sc flex items-center gap-2 text-xs not-italic">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="lining text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
