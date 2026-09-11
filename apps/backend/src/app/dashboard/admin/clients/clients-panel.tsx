"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Activity, Boxes, CreditCard, RefreshCw, Search, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const HEALTH_COLOR: Record<string, string> = {
  healthy: "bg-emerald-500",
  at_risk: "bg-amber-500",
  critical: "bg-destructive",
  inactive: "bg-muted-foreground/40",
  new: "bg-blue-500",
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
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </CardContent>
      </Card>
    );
  }

  const totals = data?.totals ?? { count: 0, paying: 0, runningServers: 0, mrr: 0 };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Users className="h-3.5 w-3.5" />}
          label="Clients"
          value={nf.format(totals.count)}
        />
        <Kpi
          icon={<CreditCard className="h-3.5 w-3.5" />}
          label="Payants"
          value={nf.format(totals.paying)}
        />
        <Kpi
          icon={<Boxes className="h-3.5 w-3.5" />}
          label="Serveurs actifs"
          value={nf.format(totals.runningServers)}
        />
        <Kpi
          icon={<Activity className="h-3.5 w-3.5" />}
          label="MRR estimé"
          value={eur.format(totals.mrr)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client (email, nom)…"
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun client ne correspond.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="w-20">Plan</TableHead>
                <TableHead className="w-28 text-right">Serveurs</TableHead>
                <TableHead className="w-20 text-right">MCPs</TableHead>
                <TableHead className="w-28 text-right">Req. 30j</TableHead>
                <TableHead className="w-24 text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/admin/clients/${c.id}` as Route)}
                >
                  <TableCell>
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
                    {c.name && <div className="pl-4 text-xs text-muted-foreground">{c.email}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={planVariant(c.plan)}>{PLAN_LABEL[c.plan]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={cn(c.serversError > 0 && "text-destructive")}>
                      {c.serversRunning}/{c.servers}
                    </span>
                    {c.serversError > 0 && (
                      <span className="ml-1 text-xs text-destructive">({c.serversError} err)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.mcps}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf.format(c.mcpRequests30d)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.mrr > 0 ? eur.format(c.mrr) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1.5">
          {icon} {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
