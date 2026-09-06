"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Locale-only copy of the statuses so this client bundle never imports the
// Drizzle schema module (which would pull pg-core into the browser).
const STATUSES = ["new", "contacted", "replied", "meeting", "won", "lost"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  replied: "A répondu",
  meeting: "RDV",
  won: "Gagné",
  lost: "Perdu",
};

const STATUS_VARIANT: Record<Status, "secondary" | "success" | "destructive" | "outline"> = {
  new: "outline",
  contacted: "secondary",
  replied: "secondary",
  meeting: "success",
  won: "success",
  lost: "destructive",
};

interface ProspectRow {
  id: string;
  company: string;
  contactName: string | null;
  email: string | null;
  role: string | null;
  source: string | null;
  status: Status;
  estimatedValueEur: number;
  notes: string;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

// A prospect is "à relancer" when its follow-up date has passed and the deal is
// still live (not won/lost).
function isDue(p: ProspectRow, nowMs: number): boolean {
  if (!p.nextActionAt || p.status === "won" || p.status === "lost") return false;
  return new Date(p.nextActionAt).getTime() <= nowMs;
}

// Pre-fills the admin's mail client with the optimised prospection email,
// personalised with the prospect's name + company.
function buildMailto(p: ProspectRow): string {
  const greeting = p.contactName ? `Bonjour ${p.contactName},` : "Bonjour,";
  const subject = `${p.company} × TwinMCP — connectez votre IA à vos outils en 10 min`;
  const body = [
    greeting,
    "",
    "Je suis le fondateur de TwinMCP.",
    "",
    "Vos équipes utilisent déjà des assistants IA (ChatGPT, Claude, Cursor…), mais ils " +
      "restent coupés de vos outils internes. TwinMCP connecte l'IA à vos applications " +
      "(bases de données, CRM, docs, APIs) en quelques minutes — une seule URL, une seule " +
      "clé, hébergé et maintenu par nous.",
    "",
    `Pour ${p.company}, concrètement :`,
    "• Vos assistants IA accèdent à vos données en toute sécurité",
    "• Déploiement en 10 min, sans infrastructure à gérer",
    "• Éligible aux aides France 2030 « Osez l'IA »",
    "",
    "Auriez-vous 15 min cette semaine pour une démo sur un cas concret ?",
    "",
    "Bien à vous,",
    "",
    "— TwinMCP · https://twinmcp.fr",
  ].join("\n");
  return `mailto:${p.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

type FormState = {
  company: string;
  contactName: string;
  email: string;
  role: string;
  source: string;
  status: Status;
  estimatedValueEur: string;
  nextActionAt: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  company: "",
  contactName: "",
  email: "",
  role: "",
  source: "",
  status: "new",
  estimatedValueEur: "",
  nextActionAt: "",
  notes: "",
};

export function ProspectsPanel() {
  const [items, setItems] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [dueOnly, setDueOnly] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProspectRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v2/admin/prospects", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: ProspectRow[] };
      setItems(data.items);
      setError("");
    } catch {
      setError("Impossible de charger les prospects.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nowMs = Date.now();

  const stats = useMemo(() => {
    let pipeline = 0;
    let won = 0;
    let due = 0;
    for (const p of items) {
      if (p.status === "won") won += p.estimatedValueEur;
      else if (p.status !== "lost") pipeline += p.estimatedValueEur;
      if (isDue(p, nowMs)) due += 1;
    }
    return { total: items.length, pipeline, won, due };
  }, [items, nowMs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (dueOnly && !isDue(p, nowMs)) return false;
      if (!q) return true;
      return (
        p.company.toLowerCase().includes(q) ||
        (p.contactName?.toLowerCase().includes(q) ?? false) ||
        (p.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, query, statusFilter, dueOnly, nowMs]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: ProspectRow) {
    setEditing(p);
    setForm({
      company: p.company,
      contactName: p.contactName ?? "",
      email: p.email ?? "",
      role: p.role ?? "",
      source: p.source ?? "",
      status: p.status,
      estimatedValueEur: p.estimatedValueEur ? String(p.estimatedValueEur) : "",
      nextActionAt: p.nextActionAt ? p.nextActionAt.slice(0, 10) : "",
      notes: p.notes,
    });
    setDialogOpen(true);
  }

  async function submitForm() {
    const company = form.company.trim();
    if (!company) {
      toast.error("Le nom de l'entreprise est requis.");
      return;
    }
    setSaving(true);
    const payload = {
      company,
      contactName: form.contactName.trim() || null,
      email: form.email.trim() || null,
      role: form.role.trim() || null,
      source: form.source.trim() || null,
      status: form.status,
      estimatedValueEur: Number(form.estimatedValueEur) || 0,
      nextActionAt: form.nextActionAt || null,
      notes: form.notes,
    };
    try {
      const res = editing
        ? await fetch(`/api/v2/admin/prospects/${editing.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/v2/admin/prospects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(editing ? "Prospect mis à jour" : "Prospect ajouté");
      setDialogOpen(false);
      await load();
    } catch {
      toast.error("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  // Optimistic inline status change from the table select.
  async function changeStatus(id: string, status: Status) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    const res = await fetch(`/api/v2/admin/prospects/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Échec de la mise à jour du statut.");
      void load();
    }
  }

  async function remove(p: ProspectRow) {
    if (!window.confirm(`Supprimer « ${p.company} » ? Cette action est définitive.`)) return;
    const res = await fetch(`/api/v2/admin/prospects/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Prospect supprimé");
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    } else {
      toast.error("Échec de la suppression.");
    }
  }

  // Opens the pre-filled prospection email; a brand-new prospect auto-advances
  // to "Contacté" so the pipeline reflects that you reached out.
  function emailProspect(p: ProspectRow) {
    window.location.href = buildMailto(p);
    if (p.status === "new") {
      void changeStatus(p.id, "contacted");
      toast.success(`${p.company} marqué comme contacté`);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Users className="h-3.5 w-3.5" />}
          label="Prospects"
          value={String(stats.total)}
        />
        <Kpi
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Pipeline ouvert"
          value={eur.format(stats.pipeline)}
        />
        <Kpi
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="Gagné"
          value={eur.format(stats.won)}
        />
        <Kpi
          icon={<BellRing className="h-3.5 w-3.5" />}
          label="À relancer"
          value={String(stats.due)}
          highlight={stats.due > 0}
          active={dueOnly}
          onClick={() => setDueOnly((v) => !v)}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une entreprise, un contact…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | Status)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={dueOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setDueOnly((v) => !v)}
          >
            <BellRing className="h-3.5 w-3.5" />À relancer
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Table / empty states */}
      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {error}{" "}
            <button className="underline" onClick={() => void load()}>
              Réessayer
            </button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Aucun prospect pour l'instant</p>
              <p className="text-sm text-muted-foreground">
                Ajoutez votre première entreprise à démarcher pour lancer votre pipeline.
              </p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Ajouter un prospect
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun prospect ne correspond à ces filtres.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-40">Statut</TableHead>
                <TableHead className="text-right">Valeur est.</TableHead>
                <TableHead>Relance</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const due = isDue(p, nowMs);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.company}</div>
                      {p.source && <div className="text-xs text-muted-foreground">{p.source}</div>}
                    </TableCell>
                    <TableCell>
                      {p.contactName || p.email ? (
                        <div className="text-sm">
                          <div>{p.contactName || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {[p.role, p.email].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.status}
                        onValueChange={(v) => void changeStatus(p.id, v as Status)}
                      >
                        <SelectTrigger className="h-8 w-full border-0 bg-transparent px-1 shadow-none focus:ring-0">
                          <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.estimatedValueEur ? eur.format(p.estimatedValueEur) : "—"}
                    </TableCell>
                    <TableCell>
                      {p.nextActionAt ? (
                        <span className={cn("text-sm", due && "font-medium text-destructive")}>
                          {shortDate.format(new Date(p.nextActionAt))}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Envoyer l'email de prospection"
                          onClick={() => emailProspect(p)}
                          disabled={!p.email}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Modifier"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Supprimer"
                          onClick={() => void remove(p)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le prospect" : "Nouveau prospect"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Mettez à jour les informations de ce prospect."
                : "Ajoutez une entreprise à démarcher à votre pipeline."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entreprise *" className="sm:col-span-2">
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Acme SAS"
              />
            </Field>
            <Field label="Contact">
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="Marie Dupont"
              />
            </Field>
            <Field label="Rôle">
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="CTO"
              />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="marie@acme.fr"
              />
            </Field>
            <Field label="Source">
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="LinkedIn, salon, référence…"
              />
            </Field>
            <Field label="Statut">
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as Status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valeur estimée (€)">
              <Input
                type="number"
                min={0}
                value={form.estimatedValueEur}
                onChange={(e) => setForm({ ...form, estimatedValueEur: e.target.value })}
                placeholder="5000"
              />
            </Field>
            <Field label="Relance le">
              <Input
                type="date"
                value={form.nextActionAt}
                onChange={(e) => setForm({ ...form, nextActionAt: e.target.value })}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Contexte, besoins, prochaines étapes…"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void submitForm()} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  highlight = false,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        onClick && "cursor-pointer transition-colors hover:border-primary/50",
        active && "border-primary ring-1 ring-primary"
      )}
    >
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1.5">
          {icon} {label}
        </CardDescription>
        <CardTitle className={cn("text-2xl", highlight && "text-destructive")}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
