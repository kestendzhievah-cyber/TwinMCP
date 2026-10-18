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
  MoreHorizontal,
  Package,
  Play,
  Puzzle,
  ScrollText,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
// Status seals follow DESIGN.md §4.9: running / provisioning / stopped / error / destroyed.
function serverVariant(s: string): "success" | "warning" | "destructive" | "secondary" | "outline" {
  if (s === "running") return "success";
  if (s === "provisioning") return "warning";
  if (s === "error") return "destructive";
  if (s === "stopped") return "secondary";
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

  async function serverAction(serverId: string, action: "stop" | "start") {
    const res = await fetch(`/api/v2/admin/clients/${clientId}/servers/${serverId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      toast.success(action === "stop" ? "Serveur arrêté." : "Serveur démarré.");
      void load();
    } else {
      const d = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(d.message ?? "Échec de l'action.");
    }
  }

  async function deleteServer(serverId: string, name: string) {
    if (!window.confirm(`Supprimer le serveur « ${name} » de ce client ? Action définitive.`)) {
      return;
    }
    const res = await fetch(`/api/v2/admin/clients/${clientId}/servers/${serverId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Serveur supprimé.");
      void load();
    } else {
      toast.error("Échec de la suppression.");
    }
  }

  async function uninstallMcp(serverId: string, userServerId: string, name: string) {
    if (!window.confirm(`Désinstaller « ${name} » ?`)) return;
    const res = await fetch(
      `/api/v2/admin/clients/${clientId}/servers/${serverId}/mcps/${userServerId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      toast.success("MCP désinstallé.");
      void load();
    } else {
      toast.error("Échec de la désinstallation.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="border border-dashed border-foreground/40 px-6 py-10 text-center">
          <p className="text-sm italic text-muted-foreground">{error || "Aucune donnée."}</p>
        </div>
      </div>
    );
  }

  const { user, servers, mcps, apiKeys, audit, usage14d } = data;
  const running = servers.filter((s) => s.status === "running").length;
  const errored = servers.filter((s) => s.status === "error").length;
  const req14 = usage14d.reduce((a, d) => a + d.req, 0);
  const maxReq = Math.max(1, ...usage14d.map((d) => d.req));

  return (
    <div className="space-y-8">
      {/* Header — the engraved name, its address line, then the double rule. */}
      <div>
        <BackLink />
        <h1 className="smallcaps tracking-sc mt-4 break-words text-2xl font-medium">
          {user.name || user.email}
        </h1>
        {user.name && <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant={user.plan === "free" ? "secondary" : "success"}>
            {PLAN_LABEL[user.plan]}
          </Badge>
          {user.subscriptionStatus && <Badge variant="outline">{user.subscriptionStatus}</Badge>}
          {user.cancelAtPeriodEnd && <Badge variant="warning">annulation prévue</Badge>}
          <span className="smallcaps tracking-sc lining text-xs text-muted-foreground">
            Client depuis {fmtDate(user.createdAt)}
          </span>
        </div>
        <Separator variant="double" className="mt-4" />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Boxes className="h-4 w-4" />}
          label="Serveurs"
          value={`${running}/${servers.length}`}
          sub={errored > 0 ? `${errored} en erreur` : "aucune erreur"}
          danger={errored > 0}
        />
        <Kpi
          icon={<Puzzle className="h-4 w-4" />}
          label="MCPs installés"
          value={nf.format(mcps.length)}
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="Requêtes 14j"
          value={nf.format(req14)}
        />
        <Kpi
          icon={<CreditCard className="h-4 w-4" />}
          label="Abonnement"
          value={user.subscriptionStatus ?? "—"}
          sub={user.currentPeriodEnd ? `jusqu'au ${fmtDate(user.currentPeriodEnd)}` : undefined}
        />
      </div>

      {/* Usage */}
      <Card>
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="lining flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
              <Activity className="h-4 w-4" />
            </span>
            Usage MCP · 14 jours
          </CardTitle>
          <CardDescription className="pl-12">
            Requêtes traitées par les box du client (par jour).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {usage14d.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-muted-foreground">
              Aucune activité sur la période.
            </p>
          ) : (
            <div>
              {/* Ink bars on a hairline baseline — a ledger chart, no rounding, no fills. */}
              <div className="flex h-28 items-end gap-px border-b border-foreground/50">
                {usage14d.map((d) => (
                  <div
                    key={d.day}
                    className="flex h-full flex-1 flex-col justify-end"
                    title={`${d.day} · ${d.req} req · ${d.err} err`}
                  >
                    <div
                      className={cn("w-full", d.err > 0 ? "bg-destructive/80" : "bg-foreground/80")}
                      style={{ height: `${(d.req / maxReq) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="lining mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{usage14d[0]?.day}</span>
                <span>{usage14d[usage14d.length - 1]?.day}</span>
              </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nom</TableHead>
                <TableHead className="w-28">Statut</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-20">Taille</TableHead>
                <TableHead>Heartbeat</TableHead>
                <TableHead className="w-56 pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-6">
                    <div className="font-medium">{s.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={serverVariant(s.status)}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.hostType}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.boxSize}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {relTime(s.lastHeartbeatAt)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {s.hostType !== "local_agent" && (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Package className="h-4 w-4" />
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
                                    <span className="text-xs italic text-muted-foreground">
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
                            <Puzzle className="h-4 w-4" />
                            MCP
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title="Cycle de vie">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {s.hostType !== "local_agent" &&
                            (s.status === "stopped" || s.status === "error") && (
                              <DropdownMenuItem onSelect={() => void serverAction(s.id, "start")}>
                                <Play className="h-4 w-4" />
                                Démarrer
                              </DropdownMenuItem>
                            )}
                          {s.hostType !== "local_agent" &&
                            (s.status === "running" || s.status === "provisioning") && (
                              <DropdownMenuItem onSelect={() => void serverAction(s.id, "stop")}>
                                <Square className="h-4 w-4" />
                                Arrêter
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => void deleteServer(s.id, s.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer le serveur
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      {/* MCPs */}
      <Section icon={<Puzzle className="h-4 w-4" />} title={`MCPs installés (${mcps.length})`}>
        {mcps.length === 0 ? (
          <Empty>Aucun MCP installé.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {/* One ledger row per MCP: live dot, name, mono slug, category, then the uninstall stamp. */}
            {mcps.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                title={`${m.mcpSlug}${m.category ? ` · ${m.category}` : ""}`}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      m.live ? "bg-success" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="font-medium">{m.mcpName}</span>
                  <span className="font-mono text-xs text-muted-foreground">{m.mcpSlug}</span>
                  {m.category && (
                    <span className="smallcaps tracking-sc text-xs text-muted-foreground">
                      {m.category}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="smallcaps tracking-sc lining text-xs text-muted-foreground">
                    installé {relTime(m.installedAt)}
                  </span>
                  {m.mcpSlug !== "twinmcp-docs" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Désinstaller"
                      onClick={() => void uninstallMcp(m.serverId, m.id, m.mcpName)}
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* API keys */}
      <Section icon={<KeyRound className="h-4 w-4" />} title={`Clés API (${apiKeys.length})`}>
        {apiKeys.length === 0 ? (
          <Empty>Aucune clé API.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {apiKeys.map((k) => (
              <li
                key={k.prefix}
                className="flex items-center justify-between gap-3 px-6 py-3 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{k.prefix}…</span>
                  {k.name && <span className="text-muted-foreground">{k.name}</span>}
                  {k.revokedAt && <Badge variant="destructive">révoquée</Badge>}
                </span>
                <span className="smallcaps tracking-sc lining shrink-0 text-xs text-muted-foreground">
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
          <ul className="divide-y divide-border">
            {audit.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-mono">{a.action}</span>{" "}
                  <span className="text-muted-foreground">{a.targetType}</span>
                </span>
                <span className="smallcaps tracking-sc lining shrink-0 text-xs text-muted-foreground">
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

// Breadcrumb-style back link (DESIGN.md §5): small caps, muted, ink on hover.
function BackLink() {
  return (
    <Link
      href={"/dashboard/admin/clients" as Route}
      className="smallcaps tracking-sc inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Tous les clients
    </Link>
  );
}

// Stat card (DESIGN.md §5): small-caps caption, lining number, italic footnote.
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
      <CardHeader>
        <CardDescription className="smallcaps tracking-sc flex items-center gap-2 text-xs not-italic">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className={cn("lining text-3xl", danger && "text-destructive")}>
          {value}
        </CardTitle>
        {sub && <p className="lining text-xs italic text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

// A section is a card: hairline icon square + small-caps title on a ruled header row,
// then flush content (ledger tables and lists run edge to edge).
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
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border px-6 py-4">
        <CardTitle className="lining flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
            {icon}
          </span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-8 text-center text-sm italic text-muted-foreground">{children}</p>;
}
