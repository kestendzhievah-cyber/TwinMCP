"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Activity,
  CreditCard,
  KeyRound,
  MoreHorizontal,
  Package,
  Pause,
  Play,
  Puzzle,
  ScrollText,
  Trash2,
  X,
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
import { lifecycleLabel } from "@/lib/server-lifecycle-label";
import { lifecycleActions } from "@/lib/server-lifecycle";
import { countsTowardKeyLimit, isKeyUsable, type KeyScope } from "@/lib/auth/key-scope";
import type { HostType, ServerStatus } from "@/db/schema/platform";
import { AdminCreateServerDialog } from "./admin-create-server-dialog";
import { AdminInstallMcpDialog } from "./admin-install-mcp-dialog";
import { WalletSection } from "./wallet-section";
import { AdminPageHeader, DENSE_TABLE, EmptyNote, IconTile, StatTile } from "../../admin-ui";

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
  hostType: HostType;
  boxSize: string;
  region: string | null;
  status: ServerStatus;
  boxId: string | null;
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
  expiresAt: string | null;
  scope: KeyScope;
  serverId: string | null;
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
// users.plan since the wallet: "pro" = funded (a first paid top-up), "free" = free credit only.
const PLAN_LABEL: Record<Plan, string> = {
  free: "Non financé",
  pro: "Financé",
  team: "Team (ancien)",
};
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
// The key's state as of now: revoked, expired (past its rotation overlap),
// retiring (still works, no longer holds a plan slot) or active
// (lib/auth/key-scope.ts).
function keyState(k: KeyRow, now: number): "revoked" | "expired" | "retiring" | "active" {
  if (k.revokedAt) return "revoked";
  const key = { revokedAt: null, expiresAt: k.expiresAt ? new Date(k.expiresAt) : null };
  if (!isKeyUsable(key, now)) return "expired";
  return countsTowardKeyLimit(key, now) ? "active" : "retiring";
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
      const d = (await res.json().catch(() => ({}))) as { status?: string };
      toast.success(
        action === "stop"
          ? "Serveur mis en pause (données conservées)."
          : d.status === "provisioning"
            ? "Provisionnement lancé."
            : "Serveur repris."
      );
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
        <EmptyNote>{error || "Aucune donnée."}</EmptyNote>
      </div>
    );
  }

  const { user, servers, mcps, apiKeys, audit, usage14d } = data;
  const running = servers.filter((s) => s.status === "running").length;
  const nowMs = Date.now();
  const keysInPlan = apiKeys.filter((k) => keyState(k, nowMs) === "active").length;
  const errored = servers.filter((s) => s.status === "error").length;
  const req14 = usage14d.reduce((a, d) => a + d.req, 0);
  const maxReq = Math.max(1, ...usage14d.map((d) => d.req));

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header: back link, the client's name with the Admin badge, then its meta row. */}
      <div className="space-y-3">
        <BackLink />
        <AdminPageHeader
          title={user.name || user.email}
          description={user.name ? <span className="break-all">{user.email}</span> : undefined}
        >
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge variant={user.plan === "free" ? "secondary" : "success"}>
              {PLAN_LABEL[user.plan]}
            </Badge>
            {user.subscriptionStatus && <Badge variant="outline">{user.subscriptionStatus}</Badge>}
            {user.cancelAtPeriodEnd && <Badge variant="warning">annulation prévue</Badge>}
            <span className="text-xs tabular-nums text-muted-foreground">
              Client depuis {fmtDate(user.createdAt)}
            </span>
          </div>
        </AdminPageHeader>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={errored > 0 ? <AlertTriangle /> : <Boxes />}
          label="Serveurs"
          value={`${running}/${servers.length}`}
          sub={errored > 0 ? `${errored} en erreur` : "aucune erreur"}
          danger={errored > 0}
        />
        <StatTile icon={<Puzzle />} label="MCPs installés" value={nf.format(mcps.length)} />
        <StatTile icon={<Activity />} label="Appels d’outils 14j" value={nf.format(req14)} />
        <StatTile
          icon={<CreditCard />}
          label="Abonnement (ancien)"
          value={user.subscriptionStatus ?? "—"}
          sub={user.currentPeriodEnd ? `jusqu'au ${fmtDate(user.currentPeriodEnd)}` : undefined}
        />
      </div>

      {/* Prepaid wallet: balances, ledger, admin grant / adjustment. */}
      <WalletSection clientId={clientId} />

      {/* Usage */}
      <Card>
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="flex items-center gap-3">
            <IconTile>
              <Activity />
            </IconTile>
            Usage MCP · 14 jours
          </CardTitle>
          <CardDescription className="sm:pl-12">
            Appels d’outils (tools/call) traités pour le client, par jour. Chaque appel qui atteint
            le MCP est débité du crédit.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-[var(--card-padding)]">
          {usage14d.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune activité sur la période.
            </p>
          ) : (
            <div>
              {/* Brand-blue bars on a hairline baseline; days with errors in red (legend below). */}
              <div className="flex h-28 items-end gap-0.5 border-b border-border">
                {usage14d.map((d) => (
                  <div
                    key={d.day}
                    className="flex h-full flex-1 flex-col justify-end"
                    title={`${d.day} · ${d.req} appels d’outils · ${d.err} en erreur`}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-sm",
                        d.err > 0 ? "bg-destructive" : "bg-brand"
                      )}
                      style={{ height: `${(d.req / maxReq) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
                <span>{usage14d[0]?.day}</span>
                <span>{usage14d[usage14d.length - 1]?.day}</span>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-sm bg-brand" />
                  Appels
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle aria-hidden className="size-3.5 text-destructive" />
                  <span aria-hidden className="size-2.5 rounded-sm bg-destructive" />
                  Jour avec erreurs
                </span>
              </p>
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
          <Table className={DENSE_TABLE}>
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
                    {/* Derived lifecycle (semantic badge tints): `stopped` reads as
                        paused (box kept) or no runtime, never the raw enum. */}
                    {(() => {
                      const view = lifecycleLabel(s, "fr");
                      return (
                        <Badge variant={view.variant} title={view.help}>
                          {view.label}
                        </Badge>
                      );
                    })()}
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
                            <Puzzle className="h-4 w-4" />
                            MCP
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cycle de vie"
                            aria-label="Cycle de vie"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Derived lifecycle (lib/server-lifecycle.ts): a paused box is
                              resumed in place (data kept); Start creates a runtime. */}
                          {(() => {
                            const actions = lifecycleActions(s);
                            return (
                              <>
                                {actions.resume && (
                                  <DropdownMenuItem
                                    onSelect={() => void serverAction(s.id, "start")}
                                  >
                                    <Play className="h-4 w-4" />
                                    Reprendre
                                  </DropdownMenuItem>
                                )}
                                {actions.start && (
                                  <DropdownMenuItem
                                    onSelect={() => void serverAction(s.id, "start")}
                                  >
                                    <Play className="h-4 w-4" />
                                    Démarrer
                                  </DropdownMenuItem>
                                )}
                                {actions.pause && (
                                  <DropdownMenuItem
                                    onSelect={() => void serverAction(s.id, "stop")}
                                  >
                                    <Pause className="h-4 w-4" />
                                    Mettre en pause
                                  </DropdownMenuItem>
                                )}
                              </>
                            );
                          })()}
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
            {/* One row per MCP: live dot, name, mono slug, category, then the uninstall button. */}
            {mcps.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                title={`${m.mcpSlug}${m.category ? ` · ${m.category}` : ""}`}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      m.live ? "bg-success" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="sr-only">{m.live ? "En ligne." : "Hors ligne."}</span>
                  <span className="font-medium">{m.mcpName}</span>
                  <span className="font-mono text-xs text-muted-foreground">{m.mcpSlug}</span>
                  {m.category && (
                    <span className="text-xs text-muted-foreground">{m.category}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-xs text-muted-foreground">
                    installé {relTime(m.installedAt)}
                  </span>
                  {m.mcpSlug !== "twinmcp-docs" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Désinstaller"
                      aria-label={`Désinstaller ${m.mcpName}`}
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
      {/* The count is the keys holding a plan slot (countsTowardKeyLimit): not
          revoked, not expired, not a replaced key in its rotation overlap. */}
      <Section
        icon={<KeyRound className="h-4 w-4" />}
        title={`Clés API (${keysInPlan} actives · ${apiKeys.length} au total)`}
      >
        {apiKeys.length === 0 ? (
          <Empty>Aucune clé API.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {apiKeys.map((k) => {
              const state = keyState(k, nowMs);
              const boundTo = k.serverId
                ? (servers.find((sv) => sv.id === k.serverId)?.name ?? "serveur supprimé")
                : "tous les serveurs";
              return (
                <li
                  key={k.prefix}
                  className="flex items-center justify-between gap-3 px-6 py-3 text-sm"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{k.prefix}…</span>
                    {k.name && <span className="text-muted-foreground">{k.name}</span>}
                    <Badge variant={k.scope === "full" ? "warning" : "secondary"}>
                      {k.scope === "full" ? "Accès complet" : `Proxy · ${boundTo}`}
                    </Badge>
                    {state === "revoked" && <Badge variant="destructive">révoquée</Badge>}
                    {state === "expired" && <Badge variant="outline">expirée</Badge>}
                    {state === "retiring" && k.expiresAt && (
                      <Badge
                        variant="info"
                        title="Remplacée par rotation : marche encore, ne compte plus dans le quota."
                      >
                        expire {fmtDate(k.expiresAt)}
                      </Badge>
                    )}
                  </span>
                  <span className="tabular-nums shrink-0 text-xs text-muted-foreground">
                    utilisée {relTime(k.lastUsedAt)}
                  </span>
                </li>
              );
            })}
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
                <span className="tabular-nums shrink-0 text-xs text-muted-foreground">
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

// Back link to the clients list: brand blue, underline on hover.
function BackLink() {
  return (
    <Link
      href={"/dashboard/admin/clients" as Route}
      className="inline-flex items-center gap-2 text-sm font-medium text-brand underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Tous les clients
    </Link>
  );
}

// A section is a card: icon tile + title on a ruled header row, then flush
// content (tables and lists run edge to edge).
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
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border py-4">
        <CardTitle className="flex items-center gap-3 tabular-nums">
          <IconTile>{icon}</IconTile>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
