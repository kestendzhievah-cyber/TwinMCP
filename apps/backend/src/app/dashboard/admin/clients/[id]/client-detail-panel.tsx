"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  Boxes,
  Activity,
  CreditCard,
  KeyRound,
  Package,
  ScrollText,
  Puzzle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MCP_BUNDLES } from "@/lib/mcp-bundles";
import { AdminCreateServerDialog } from "./admin-create-server-dialog";
import { AdminInstallMcpDialog } from "./admin-install-mcp-dialog";

type Plan = "free" | "pro" | "team";

interface DetailUser {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  onboardingCompletedAt: string | null;
  createdAt: string;
}
interface ServerRow {
  id: string;
  name: string;
  slug: string;
  hostType: string;
  boxSize: string;
  region: string | null;
  status: string;
  endpointUrl: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
}
interface McpRow {
  id: string;
  serverId: string;
  enabled: boolean;
  installedAt: string;
  live: boolean;
  mcpName: string;
  mcpSlug: string;
  category: string | null;
  hostMode: string;
}
interface KeyRow {
  prefix: string;
  name: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}
interface AuditRow {
  action: string;
  targetType: string;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
}
interface Detail {
  user: DetailUser;
  servers: ServerRow[];
  mcps: McpRow[];
  apiKeys: KeyRow[];
  audit: AuditRow[];
  usage14d: { day: string; req: number; err: number }[];
}

const nf = new Intl.NumberFormat("fr-FR");
const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fmtDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}
function relTime(iso: string | null): string {
  if (!iso) return "jamais";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
function serverVariant(s: string): "success" | "destructive" | "secondary" | "outline" {
  if (s === "running") return "success";
  if (s === "error") return "destructive";
  if (s === "destroyed") return "secondary";
  return "outline";
}

export function ClientDetailPanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [installServerId, setInstallServerId] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/admin/clients/${clientId}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("Client introuvable.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Detail);
      setError("");
    } catch {
      setError("Impossible de charger ce client.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function installBundle(serverId: string, bundleId: string) {
    const res = await fetch(`/api/v2/admin/clients/${clientId}/servers/${serverId}/bundle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundleId }),
    });
    const d = (await res.json().catch(() => ({}))) as {
      installed?: string[];
      skipped?: { slug: string; reason: string }[];
      message?: string;
    };
    if (res.ok) {
      const ins = d.installed?.length ?? 0;
      const sk = d.skipped?.length ?? 0;
      toast.success(`Pack déployé : ${ins} installé(s)${sk ? ` · ${sk} ignoré(s)` : ""}`);
      void load();
    } else {
      toast.error(d.message ?? "Échec du déploiement du pack.");
    }
  }

  if (loading) return <Skeleton className="h-96 w-full" />;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {error || "Aucune donnée."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, servers, mcps, apiKeys, audit, usage14d } = data;
  const running = servers.filter((s) => s.status === "running").length;
  const errored = servers.filter((s) => s.status === "error").length;
  const req14 = usage14d.reduce((a, d) => a + d.req, 0);
  const maxReq = Math.max(1, ...usage14d.map((d) => d.req));

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.name || user.email}</h1>
          {user.name && <p className="text-sm text-muted-foreground">{user.email}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={user.plan === "free" ? "secondary" : "success"}>
              {PLAN_LABEL[user.plan]}
            </Badge>
            {user.subscriptionStatus && <Badge variant="outline">{user.subscriptionStatus}</Badge>}
            {user.cancelAtPeriodEnd && <Badge variant="destructive">annulation prévue</Badge>}
            <span className="text-xs text-muted-foreground">
              Client depuis {fmtDate(user.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Boxes className="h-3.5 w-3.5" />}
          label="Serveurs"
          value={`${running}/${servers.length}`}
          sub={errored > 0 ? `${errored} en erreur` : "aucune erreur"}
          danger={errored > 0}
        />
        <Kpi
          icon={<Puzzle className="h-3.5 w-3.5" />}
          label="MCPs installés"
          value={nf.format(mcps.length)}
        />
        <Kpi
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Requêtes 14j"
          value={nf.format(req14)}
        />
        <Kpi
          icon={<CreditCard className="h-3.5 w-3.5" />}
          label="Abonnement"
          value={user.subscriptionStatus ?? "—"}
          sub={user.currentPeriodEnd ? `jusqu'au ${fmtDate(user.currentPeriodEnd)}` : undefined}
        />
      </div>

      {/* Usage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Usage MCP · 14 jours</CardTitle>
          <CardDescription>Requêtes traitées par les box du client (par jour).</CardDescription>
        </CardHeader>
        <CardContent>
          {usage14d.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune activité sur la période.
            </p>
          ) : (
            <div className="flex h-28 items-end gap-1">
              {usage14d.map((d) => (
                <div
                  key={d.day}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${d.day} · ${d.req} req · ${d.err} err`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-sm",
                      d.err > 0 ? "bg-destructive/70" : "bg-primary/80"
                    )}
                    style={{ height: `${(d.req / maxReq) * 100}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Servers */}
      <Section
        icon={<Boxes className="h-4 w-4" />}
        title={`Serveurs (${servers.length})`}
        action={<AdminCreateServerDialog clientId={clientId} onDone={() => void load()} />}
      >
        {servers.length === 0 ? (
          <Empty>Aucun serveur. Créez-en un pour ce client.</Empty>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="w-24">Statut</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-20">Taille</TableHead>
                  <TableHead>Heartbeat</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{s.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={serverVariant(s.status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{s.hostType}</TableCell>
                    <TableCell className="text-xs">{s.boxSize}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relTime(s.lastHeartbeatAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.hostType !== "local_agent" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Package className="h-3.5 w-3.5" />
                                Pack
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-w-xs">
                              <DropdownMenuLabel>Déployer un pack</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {MCP_BUNDLES.map((b) => (
                                <DropdownMenuItem
                                  key={b.id}
                                  onSelect={() => void installBundle(s.id, b.id)}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{b.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {b.description}
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setInstallServerId(s.id);
                              setInstallOpen(true);
                            }}
                          >
                            <Puzzle className="h-3.5 w-3.5" />
                            MCP
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* MCPs */}
      <Section icon={<Puzzle className="h-4 w-4" />} title={`MCPs installés (${mcps.length})`}>
        {mcps.length === 0 ? (
          <Empty>Aucun MCP installé.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {mcps.map((m) => (
              <Badge
                key={m.id}
                variant={m.enabled ? "secondary" : "outline"}
                className="gap-1.5 py-1"
                title={`${m.mcpSlug}${m.category ? ` · ${m.category}` : ""}`}
              >
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    m.live ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
                {m.mcpName}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {/* API keys */}
      <Section icon={<KeyRound className="h-4 w-4" />} title={`Clés API (${apiKeys.length})`}>
        {apiKeys.length === 0 ? (
          <Empty>Aucune clé API.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {apiKeys.map((k) => (
              <li key={k.prefix} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs">{k.prefix}…</span>
                  {k.name && <span className="text-muted-foreground">{k.name}</span>}
                  {k.revokedAt && <Badge variant="destructive">révoquée</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">
                  utilisée {relTime(k.lastUsedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Audit */}
      <Section icon={<ScrollText className="h-4 w-4" />} title="Activité récente">
        {audit.length === 0 ? (
          <Empty>Aucune activité.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {audit.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="font-medium">{a.action}</span>{" "}
                  <span className="text-muted-foreground">{a.targetType}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AdminInstallMcpDialog
        clientId={clientId}
        serverId={installServerId}
        open={installOpen}
        onOpenChange={setInstallOpen}
        onDone={() => void load()}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={"/dashboard/admin/clients" as Route}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Tous les clients
    </Link>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1.5">
          {icon} {label}
        </CardDescription>
        <CardTitle className={cn("text-2xl", danger && "text-destructive")}>{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      )}
    </Card>
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
      <CardHeader className="pb-3">
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
