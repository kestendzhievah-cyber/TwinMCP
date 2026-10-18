"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  HeartPulse,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
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
  clientsAtRisk: { userId: string; email: string; plan: string; status: string; reason: string }[];
  counts: {
    followUpsDue: number;
    newLeads: number;
    serversInError: number;
    stuckProvisioning: number;
    newSignups: number;
    clientsAtRisk: number;
    total: number;
  };
}

const HEALTH_LABEL: Record<string, string> = {
  critical: "Critique",
  at_risk: "À risque",
  inactive: "Inactif",
  new: "Nouveau",
  healthy: "OK",
};
function healthVariant(s: string): "destructive" | "secondary" | "outline" {
  if (s === "critical") return "destructive";
  if (s === "at_risk") return "secondary";
  return "outline";
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

// Quiet navigation links inside the ledgers: small capitals, brand underline on hover.
const quietLink =
  "smallcaps tracking-sc shrink-0 text-xs text-muted-foreground decoration-brand underline-offset-4 hover:text-foreground hover:underline";

export function CockpitPanel() {
  const [data, setData] = useState<Attention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  async function sendDigest() {
    setSending(true);
    try {
      const res = await fetch("/api/cron/digest", { method: "POST" });
      if (res.ok) {
        const d = (await res.json()) as { sentTo: string };
        toast.success(`Digest envoyé à ${d.sentTo}`);
      } else {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(d.message ?? "Échec de l'envoi du digest.");
      }
    } catch {
      toast.error("Échec de l'envoi du digest.");
    } finally {
      setSending(false);
    }
  }

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
      <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {error || "Aucune donnée."}{" "}
          <button
            className="underline decoration-destructive/40 underline-offset-4 hover:decoration-destructive"
            onClick={() => void load()}
          >
            Réessayer
          </button>
        </p>
      </div>
    );
  }

  const {
    followUpsDue,
    newLeads,
    serversInError,
    stuckProvisioning,
    newSignups,
    clientsAtRisk,
    counts,
  } = data;

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
          <Chip
            label="Clients à risque"
            value={counts.clientsAtRisk}
            danger={counts.clientsAtRisk > 0}
          />
          <Chip label="Inscrits 24 h" value={counts.newSignups} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void sendDigest()} disabled={sending}>
            <Mail className="h-4 w-4" />
            {sending ? "Envoi…" : "M'envoyer le digest"}
          </Button>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {counts.total === 0 && clientsAtRisk.length === 0 && (
        <Card className="border-dashed border-foreground/40 bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <p className="smallcaps tracking-sc font-medium">Tout est à jour</p>
            <p className="text-sm italic text-muted-foreground">
              Aucune relance en retard, aucun serveur en erreur, aucun nouveau lead à traiter.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Relances du jour */}
      {followUpsDue.length > 0 && (
        <Section
          icon={<BellRing className="h-4 w-4" />}
          title="Relances du jour"
          count={followUpsDue.length}
          action={
            <Link href={CRM} className={quietLink}>
              Ouvrir le CRM →
            </Link>
          }
        >
          <ul className="divide-y divide-border text-sm">
            {followUpsDue.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{p.company}</span>
                  {p.contactName && (
                    <span className="text-muted-foreground"> · {p.contactName}</span>
                  )}
                  {(p.email || p.phone) && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {[p.email, p.phone].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="lining shrink-0 text-xs font-medium text-destructive">
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
          title="Nouveaux leads · 24 h"
          count={newLeads.length}
          action={
            <Link href={CRM} className={quietLink}>
              Ouvrir le CRM →
            </Link>
          }
        >
          <ul className="divide-y divide-border text-sm">
            {newLeads.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{p.company}</span>
                  {p.source && <span className="text-xs text-muted-foreground"> · {p.source}</span>}
                </span>
                <span className="lining shrink-0 text-xs text-muted-foreground">
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
          title="Serveurs en erreur"
          count={serversInError.length}
        >
          <ul className="divide-y divide-border text-sm">
            {serversInError.map((s) => (
              <li key={s.serverId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-1 font-mono text-xs text-muted-foreground">· {s.email}</span>
                </span>
                <Link href={`/dashboard/admin/clients/${s.userId}` as Route} className={quietLink}>
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
          title="Provisioning bloqué > 15 min"
          count={stuckProvisioning.length}
        >
          <ul className="divide-y divide-border text-sm">
            {stuckProvisioning.map((s) => (
              <li key={s.serverId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-1 font-mono text-xs text-muted-foreground">· {s.email}</span>
                </span>
                <Link href={`/dashboard/admin/clients/${s.userId}` as Route} className={quietLink}>
                  Voir le client →
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Clients à risque (churn) */}
      {clientsAtRisk.length > 0 && (
        <Section
          icon={<HeartPulse className="h-4 w-4 text-destructive" />}
          title="Clients à risque"
          count={clientsAtRisk.length}
        >
          <ul className="divide-y divide-border text-sm">
            {clientsAtRisk.map((c) => (
              <li key={c.userId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge variant={healthVariant(c.status)}>
                    {HEALTH_LABEL[c.status] ?? c.status}
                  </Badge>
                  <span className="min-w-0">
                    <span className="font-mono text-xs">{c.email}</span>
                    <span className="text-xs text-muted-foreground"> · {c.reason}</span>
                  </span>
                </span>
                <Link href={`/dashboard/admin/clients/${c.userId}` as Route} className={quietLink}>
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
          title="Nouveaux inscrits · 24 h"
          count={newSignups.length}
        >
          <ul className="divide-y divide-border text-sm">
            {newSignups.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/dashboard/admin/clients/${u.id}` as Route}
                    className="truncate font-mono text-xs decoration-brand underline-offset-4 hover:underline"
                  >
                    {u.email}
                  </Link>
                  <Badge variant={u.plan === "free" ? "secondary" : "success"}>{u.plan}</Badge>
                </span>
                <span className="lining shrink-0 text-xs text-muted-foreground">
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

// A tally chip: square, hairline, small-caps caption with a lining count.
// The total gets an ink hairline; anything broken gets the oxblood tint.
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
  const alert = danger && value > 0;
  return (
    <span
      className={cn(
        "smallcaps tracking-sc inline-flex h-8 items-center gap-2 border border-border px-2.5 text-xs text-muted-foreground",
        highlight && "border-foreground/60 text-foreground",
        alert && "border-destructive/40 bg-destructive/10 text-destructive"
      )}
    >
      {label}
      <span className={cn("lining font-medium", !alert && "text-foreground")}>{value}</span>
    </span>
  );
}

// A ledger card: hairline icon square, small-caps title with its count, a
// hairline under the header, rows divided by hairlines inside.
function Section({
  icon,
  title,
  count,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
              {icon}
            </span>
            <CardTitle className="text-base">{title}</CardTitle>
            {typeof count === "number" && (
              <Badge variant="outline" className="lining">
                {count}
              </Badge>
            )}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
