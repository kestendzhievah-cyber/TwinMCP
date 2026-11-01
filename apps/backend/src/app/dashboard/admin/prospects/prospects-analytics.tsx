"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  PIPELINE_ORDER,
  STATUS_LABEL,
  STATUS_PROBABILITY,
  STATUS_VARIANT,
  STATUSES,
  eur,
  weightedPipeline,
  type ProspectRow,
} from "./prospects-shared";
import { DENSE_TABLE, EmptyNote, StatTile } from "../admin-ui";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function ProspectsAnalytics({ items }: { items: ProspectRow[] }) {
  // Funnel: how many prospects have reached (are at or beyond) each stage. Lost
  // deals are an exit, not a stage, so they're excluded.
  const idxOf = (s: (typeof PIPELINE_ORDER)[number]) => PIPELINE_ORDER.indexOf(s);
  const funnel = PIPELINE_ORDER.map((s) => ({
    status: s,
    count: items.filter((p) => p.status !== "lost" && idxOf(p.status) >= idxOf(s)).length,
  }));
  const top = funnel[0]?.count ?? 0;

  const won = items.filter((p) => p.status === "won").length;
  const lost = items.filter((p) => p.status === "lost").length;
  const winRate = pct(won, won + lost);
  const weighted = weightedPipeline(items);

  const byStatus = STATUSES.map((s) => {
    const rows = items.filter((p) => p.status === s);
    return {
      status: s,
      count: rows.length,
      value: rows.reduce((a, p) => a + p.estimatedValueEur, 0),
    };
  });

  if (items.length === 0) {
    return <EmptyNote>Ajoutez des prospects pour voir vos statistiques de conversion.</EmptyNote>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Prévision pondérée"
          value={eur.format(weighted)}
          sub="Revenu attendu (valeur × probabilité par étape)."
        />
        <StatTile
          label="Taux de closing"
          value={`${winRate}%`}
          sub={`${won} gagné${won > 1 ? "s" : ""} · ${lost} perdu${lost > 1 ? "s" : ""}`}
        />
        <StatTile
          label="Deals actifs"
          value={items.filter((p) => p.status !== "won" && p.status !== "lost").length}
          sub="Prospects encore en jeu."
        />
      </div>

      {/* Conversion funnel */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">Entonnoir de conversion</CardTitle>
          <CardDescription>
            Prospects ayant atteint chaque étape, et taux de passage d'une étape à la suivante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* One row per stage: the stage badge, a brand progress bar, the count
              and the step conversion. */}
          <div className="divide-y divide-border tabular-nums">
            {funnel.map((stage, i) => {
              const prev = i > 0 ? funnel[i - 1].count : null;
              const conv = prev != null ? pct(stage.count, prev) : null;
              return (
                <div key={stage.status} className="flex items-center gap-4 py-3">
                  <div className="w-24 shrink-0">
                    <Badge variant={STATUS_VARIANT[stage.status]}>
                      {STATUS_LABEL[stage.status]}
                    </Badge>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${top > 0 ? Math.max((stage.count / top) * 100, stage.count > 0 ? 8 : 0) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="w-10 shrink-0 text-right text-sm font-semibold">
                    {stage.count > 0 ? stage.count : "—"}
                  </div>
                  <div className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                    {conv != null ? `${conv}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Value by status */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Répartition par statut</CardTitle>
        </CardHeader>
        {/* A table set flush in the card (the card is the frame). */}
        <Table className={DENSE_TABLE}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Statut</TableHead>
              <TableHead className="text-right">Prospects</TableHead>
              <TableHead className="text-right">Valeur</TableHead>
              <TableHead className="pr-6 text-right">Probabilité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byStatus.map((b) => (
              <TableRow key={b.status}>
                <TableCell className="pl-6">
                  <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                </TableCell>
                <TableCell className="text-right">{b.count}</TableCell>
                <TableCell className="text-right">
                  {b.value > 0 ? eur.format(b.value) : "—"}
                </TableCell>
                <TableCell className="pr-6 text-right text-muted-foreground">
                  {Math.round(STATUS_PROBABILITY[b.status] * 100)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
