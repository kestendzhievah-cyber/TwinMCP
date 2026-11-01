"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, fieldClasses } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { describeLedgerEntry, formatCredit, formatSignedCredit } from "@/lib/billing/upgrade-state";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IconTile } from "../../admin-ui";

interface AdminWallet {
  paidMicros: number;
  promoMicros: number;
  promoExpiresAt: string | null;
  promoExpired: boolean;
  totalMicros: number;
  funded: boolean;
  fundedAt: string | null;
  zeroBalanceAt: string | null;
  autoRecharge: {
    enabled: boolean;
    thresholdMicros: number;
    amountMicros: number;
    monthlyCapMicros: number;
    hasPaymentMethod: boolean;
  };
}

interface AdminLedgerEntry {
  id: string;
  deltaMicros: number;
  bucket: string;
  kind: string;
  balanceAfterMicros: number;
  units: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
}

const fr = (m: number) => formatCredit(m, { locale: "fr", precise: false });

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000".replace(/0/g, () =>
        Math.floor(Math.random() * 16).toString(16)
      );
}

/**
 * Portefeuille prépayé du client (console B2B) : soldes, historique du
 * registre, et ajout / retrait de crédit avec un motif (route
 * /api/v2/admin/clients/[id]/credit, requireAdmin, audité, idempotent).
 */
export function WalletSection({ clientId }: { clientId: string }) {
  const [wallet, setWallet] = useState<AdminWallet | null>(null);
  const [entries, setEntries] = useState<AdminLedgerEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (cursor?: string) => {
      try {
        const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        const res = await fetch(`/api/v2/admin/clients/${clientId}/credit${qs}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as {
          wallet: AdminWallet;
          ledger: { entries: AdminLedgerEntry[]; nextCursor: string | null };
        };
        setWallet(d.wallet);
        setEntries((prev) => (cursor ? [...prev, ...d.ledger.entries] : d.ledger.entries));
        setNextCursor(d.ledger.nextCursor);
        setError("");
      } catch {
        setError("Impossible de charger le portefeuille.");
      } finally {
        setLoading(false);
      }
    },
    [clientId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4">
        <CardTitle className="flex flex-wrap items-center gap-3">
          <IconTile>
            <Wallet />
          </IconTile>
          Crédit prépayé
          {wallet && (
            <Badge variant={wallet.funded ? "success" : "secondary"}>
              {wallet.funded ? "Financé" : "Crédit offert"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="sm:pl-12">
          Soldes, mouvements du registre, et ajout ou retrait de crédit avec un motif (audité).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-[var(--card-padding)]">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : error || !wallet ? (
          <p className="text-sm text-muted-foreground">{error || "Aucune donnée."}</p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
              <BalancePanel wallet={wallet} />
              <dl className="grid gap-4 tabular-nums sm:grid-cols-3">
                <Stat label="Payé" value={fr(wallet.paidMicros)} />
                <Stat
                  label="Offert"
                  value={fr(wallet.promoMicros)}
                  sub={
                    wallet.promoExpiresAt
                      ? `${wallet.promoExpired ? "expiré le" : "expire le"} ${formatDateTime(wallet.promoExpiresAt)}`
                      : undefined
                  }
                />
                <Stat
                  label="Recharge auto"
                  value={wallet.autoRecharge.enabled ? "Active" : "Inactive"}
                  sub={
                    wallet.autoRecharge.enabled
                      ? `${fr(wallet.autoRecharge.amountMicros)} sous ${fr(wallet.autoRecharge.thresholdMicros)}`
                      : wallet.autoRecharge.hasPaymentMethod
                        ? "carte enregistrée"
                        : "pas de carte"
                  }
                />
              </dl>
            </div>
            <AdjustForm clientId={clientId} onDone={() => void load()} />
          </>
        )}
      </CardContent>
      {wallet && (
        <CardContent className="border-t border-border p-0">
          {entries.length === 0 ? (
            <p className="px-6 py-6 text-center text-sm text-muted-foreground">Aucun mouvement.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="[&_td]:py-2">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40 pl-6">Date (UTC)</TableHead>
                    <TableHead>Mouvement</TableHead>
                    <TableHead className="w-28 text-right">Montant</TableHead>
                    <TableHead className="w-28 pr-6 text-right">Solde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap pl-6 text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className="mr-2">{describeLedgerEntry(e)}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {e.kind} · {e.bucket}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right",
                          e.deltaMicros > 0 && "text-success"
                        )}
                      >
                        {formatSignedCredit(e.deltaMicros, "fr")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap pr-6 text-right">
                        {fr(e.balanceAfterMicros)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {nextCursor && (
            <button
              type="button"
              onClick={() => void load(nextCursor)}
              className="w-full rounded-b-2xl border-t border-border py-3 text-sm font-medium text-brand transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              Plus ancien
            </button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * The client's balance in the dashboard CreditCard visual (spec §4.11/§6):
 * soft-pink offer card while only free credit is live, a quiet card once
 * funded, red with an icon at or below zero. The figure is the key number
 * (rose); the stacked bar splits paid (brand) and free credit (rose).
 */
function BalancePanel({ wallet }: { wallet: AdminWallet }) {
  const paid = Math.max(0, wallet.paidMicros);
  const promo = wallet.promoExpired ? 0 : Math.max(0, wallet.promoMicros);
  const whole = paid + promo;
  const empty = wallet.totalMicros <= 0;
  const promoOnly = !wallet.funded && promo > 0 && !empty;
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        empty
          ? "border-destructive/30 bg-destructive/10"
          : promoOnly
            ? "border-offer-border bg-offer"
            : "border-border bg-secondary"
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          empty ? "text-destructive" : promoOnly ? "text-offer-foreground" : "text-muted-foreground"
        )}
      >
        {empty && <AlertTriangle aria-hidden className="size-3.5 shrink-0" />}
        Solde total
      </p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-bold tabular-nums tracking-tight",
          empty ? "text-destructive" : "text-primary"
        )}
      >
        {fr(wallet.totalMicros)}
      </p>
      {whole > 0 && (
        <>
          <div
            className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-offer-border"
            role="img"
            aria-label={`Payé ${fr(paid)}, offert ${fr(promo)}`}
          >
            <div className="h-full bg-brand" style={{ width: `${(paid / whole) * 100}%` }} />
            <div className="h-full bg-primary" style={{ width: `${(promo / whole) * 100}%` }} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-brand" />
              Payé
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-primary" />
              Offert
            </span>
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-xl font-bold tracking-tight">{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

function AdjustForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [bucket, setBucket] = useState<"paid" | "promo">("promo");
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // One id per intended operation: a double submit or a retry reuses it, so
  // the server applies the change once.
  const [requestId, setRequestId] = useState(newRequestId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountEur = Number(amount.trim().replace(",", "."));
    if (!Number.isFinite(amountEur) || amountEur === 0) {
      setError("Montant en euros, positif pour ajouter, négatif pour retirer.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Indiquez un motif (3 caractères minimum).");
      return;
    }
    if (amountEur > 0 && bucket === "promo") {
      const d = Number.parseInt(days, 10);
      if (!Number.isFinite(d) || d < 1 || d > 365) {
        setError("Le crédit offert expire toujours : indiquez 1 à 365 jours.");
        return;
      }
    }
    const verb = amountEur > 0 ? "Ajouter" : "Retirer";
    if (
      !window.confirm(
        `${verb} ${Math.abs(amountEur)} € (${bucket === "promo" ? "offert" : "payé"}) ?`
      )
    ) {
      return;
    }
    const n = Number.parseInt(days, 10);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/v2/admin/clients/${clientId}/credit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountEur,
          bucket,
          reason: reason.trim(),
          requestId,
          ...(amountEur > 0 && bucket === "promo" && Number.isFinite(n) && n > 0
            ? { expiresInDays: n }
            : {}),
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { applied?: boolean; message?: string };
      if (!res.ok) {
        setError(d.message ?? "Échec de l'ajustement.");
      } else {
        toast.success(d.applied === false ? "Déjà appliqué." : "Crédit mis à jour.");
        setAmount("");
        setReason("");
        setRequestId(newRequestId());
        onDone();
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border pt-5" noValidate>
      <p className="font-display text-base font-semibold tracking-tight">
        Ajouter ou retirer du crédit
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="adj-amount">Montant (€)</Label>
          <Input
            id="adj-amount"
            inputMode="decimal"
            placeholder="10 ou -5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adj-bucket">Compartiment</Label>
          <select
            id="adj-bucket"
            value={bucket}
            onChange={(e) => setBucket(e.target.value === "paid" ? "paid" : "promo")}
            className={cn(fieldClasses, "flex h-10 [&>option]:bg-card [&>option]:text-foreground")}
          >
            <option value="promo">Offert (promo)</option>
            <option value="paid">Payé</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adj-days">Expire après (jours)</Label>
          <Input
            id="adj-days"
            inputMode="numeric"
            value={days}
            disabled={bucket !== "promo"}
            onChange={(e) => setDays(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adj-reason">Motif</Label>
          <Input
            id="adj-reason"
            placeholder="Geste commercial, correction…"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Un retrait peut rendre le solde négatif. Le crédit payé ajouté ici ne compte pas comme un
        premier paiement (le compte reste non financé).
      </p>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      {/* Outline: "Créer un serveur" is this screen's one rose primary. */}
      <Button type="submit" variant="outline" disabled={saving}>
        {saving ? "Enregistrement…" : "Appliquer"}
      </Button>
    </form>
  );
}
