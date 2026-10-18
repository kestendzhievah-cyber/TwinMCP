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
import {
  PIPELINE_ORDER,
  STATUS_LABEL,
  STATUS_PROBABILITY,
  STATUSES,
  eur,
  weightedPipeline,
  type ProspectRow,
} from "./prospects-shared";

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
    return (
      <div className="border border-dashed border-foreground/40 px-6 py-10 text-center">
        <p className="text-sm italic text-muted-foreground">
          Ajoutez des prospects pour voir vos statistiques de conversion.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards (DESIGN.md §5): small-caps caption, lining number, one muted line under. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Prévision pondérée
            </CardDescription>
            <CardTitle className="lining text-3xl">{eur.format(weighted)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs italic text-muted-foreground">
              Revenu attendu (valeur × probabilité par étape).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Taux de closing
            </CardDescription>
            <CardTitle className="lining text-3xl">{winRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="lining text-xs text-muted-foreground">
              {won} gagné{won > 1 ? "s" : ""} · {lost} perdu{lost > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Deals actifs
            </CardDescription>
            <CardTitle className="lining text-3xl">
              {items.filter((p) => p.status !== "won" && p.status !== "lost").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs italic text-muted-foreground">Prospects encore en jeu.</p>
          </CardContent>
        </Card>
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
          {/* A ledger of stages: hairline rows, small-caps stage, a thin ink rule on bone
              (the stat-card progress bar), then the lining count and the step conversion. */}
          <div className="lining divide-y divide-border">
            {funnel.map((stage, i) => {
              const prev = i > 0 ? funnel[i - 1].count : null;
              const conv = prev != null ? pct(stage.count, prev) : null;
              return (
                <div key={stage.status} className="flex items-center gap-4 py-3">
                  <div className="smallcaps tracking-sc w-24 shrink-0 text-xs font-medium">
                    {STATUS_LABEL[stage.status]}
                  </div>
                  <div className="h-1.5 flex-1 bg-secondary">
                    <div
                      className="h-full bg-foreground"
                      style={{
                        width: `${top > 0 ? Math.max((stage.count / top) * 100, stage.count > 0 ? 8 : 0) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="w-10 shrink-0 text-right text-sm font-medium">
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Répartition par statut</CardTitle>
        </CardHeader>
        {/* A ledger table (DESIGN.md §4.5) set flush in the card, instead of a row of chips. */}
        <Table>
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
                <TableCell className="smallcaps tracking-sc pl-6 text-xs font-medium">
                  {STATUS_LABEL[b.status]}
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
