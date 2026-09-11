"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Attention {
  followUpsDue: {
    id: string;
    company: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    nextActionAt: string | null;
  }[];
  newLeads: { id: string; company: string; source: string | null; createdAt: string }[];
  serversInError: { serverId: string; name: string; userId: string; email: string }[];
  stuckProvisioning: {
    serverId: string;
    name: string;
    userId: string;
    email: string;
    createdAt: string;
  }[];
  newSignups: { id: string; email: string; plan: string; createdAt: string }[];
  counts: {
    followUpsDue: number;
    newLeads: number;
    serversInError: number;
    stuckProvisioning: number;
    newSignups: number;
    total: number;
  };
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const past = diff >= 0;
  const s = Math.round(Math.abs(diff) / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const val = d > 0 ? `${d} j` : h > 0 ? `${h} h` : m > 0 ? `${m} min` : `${s} s`;
  return past ? `il y a ${val}` : `dans ${val}`;
}

const CRM: Route = "/dashboard/admin/prospects" as Route;

export function CockpitPanel() {
  const [data, setData] = useState<Attention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v2/admin/attention", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Attention);
      setError("");
    } catch {
      setError("Impossible de charger le cockpit.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton className="h-80 w-full" />;

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error || "Aucune donnée."}{" "}
          <button className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </CardContent>
      </Card>
    );
  }

  const { followUpsDue, newLeads, serversInError, stuckProvisioning, newSignups, counts } = data;

  return (
    <div className="space-y-6">
      {/* Summary + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="À traiter" value={counts.total} highlight={counts.total > 0} />
          <Chip label="Relances" value={counts.followUpsDue} />
          <Chip label="Nouveaux leads" value={counts.newLeads} />
          <Chip
            label="Serveurs KO"
            value={counts.serversInError}
            danger={counts.serversInError > 0}
          />
          <Chip
            label="Provisioning bloqué"
            value={counts.stuckProvisioning}
            danger={counts.stuckProvisioning > 0}
          />
          <Chip label="Inscrits 24 h" value={counts.newSignups} />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </Button>
      </div>

      {counts.total === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="font-medium">Tout est à jour 🎉</p>
            <p className="text-sm text-muted-foreground">
              Aucune relance en retard, aucun serveur en erreur, aucun nouveau lead à traiter.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Relances du jour */}
      {followUpsDue.length > 0 && (
        <Section
          icon={<BellRing className="h-4 w-4" />}
          title={`Relances du jour (${followUpsDue.length})`}
          action={
            <Link href={CRM} className="text-xs text-muted-foreground hover:text-foreground">
              Ouvrir le CRM →
            </Link>
          }
        >
          <ul className="divide-y">
            {followUpsDue.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{p.company}</span>
                  {p.contactName && (
                    <span className="text-muted-foreground"> · {p.contactName}</span>
                  )}
                  {(p.email || p.phone) && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {[p.email, p.phone].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-medium text-destructive">
                  {relTime(p.nextActionAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Nouveaux leads */}
      {newLeads.length > 0 && (
        <Section
          icon={<Sparkles className="h-4 w-4" />}
          title={`Nouveaux leads · 24 h (${newLeads.length})`}
          action={
            <Link href={CRM} className="text-xs text-muted-foreground hover:text-foreground">
              Ouvrir le CRM →
            </Link>
          }
        >
          <ul className="divide-y">
            {newLeads.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{p.company}</span>
                  {p.source && <span className="text-xs text-muted-foreground"> · {p.source}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relTime(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Serveurs en erreur */}
      {serversInError.length > 0 && (
        <Section
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          title={`Serveurs en erreur (${serversInError.length})`}
        >
          <ul className="divide-y">
            {serversInError.map((s) => (
              <li key={s.serverId} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground"> · {s.email}</span>
                </span>
                <Link
                  href={`/dashboard/admin/clients/${s.userId}` as Route}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Voir le client →
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Provisioning bloqué */}
      {stuckProvisioning.length > 0 && (
        <Section
          icon={<Loader2 className="h-4 w-4 text-destructive" />}
          title={`Provisioning bloqué > 15 min (${stuckProvisioning.length})`}
        >
          <ul className="divide-y">
            {stuckProvisioning.map((s) => (
              <li key={s.serverId} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground"> · {s.email}</span>
                </span>
                <Link
                  href={`/dashboard/admin/clients/${s.userId}` as Route}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Voir le client →
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Nouveaux inscrits */}
      {newSignups.length > 0 && (
        <Section
          icon={<UserPlus className="h-4 w-4" />}
          title={`Nouveaux inscrits · 24 h (${newSignups.length})`}
        >
          <ul className="divide-y">
            {newSignups.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/admin/clients/${u.id}` as Route}
                    className="font-mono text-xs hover:underline"
                  >
                    {u.email}
                  </Link>
                  <Badge variant={u.plan === "free" ? "secondary" : "success"}>{u.plan}</Badge>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relTime(u.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  highlight = false,
  danger = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        highlight && "border-primary/40",
        danger && value > 0 && "border-destructive/40 text-destructive"
      )}
    >
      {label}
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon} {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
