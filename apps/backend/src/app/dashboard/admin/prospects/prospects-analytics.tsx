"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Ajoutez des prospects pour voir vos statistiques de conversion.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prévision pondérée</CardDescription>
            <CardTitle className="text-2xl">{eur.format(weighted)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Revenu attendu (valeur × probabilité par étape).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taux de closing</CardDescription>
            <CardTitle className="text-2xl">{winRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {won} gagné{won > 1 ? "s" : ""} · {lost} perdu{lost > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Deals actifs</CardDescription>
            <CardTitle className="text-2xl">
              {items.filter((p) => p.status !== "won" && p.status !== "lost").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Prospects encore en jeu.</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entonnoir de conversion</CardTitle>
          <CardDescription>
            Prospects ayant atteint chaque étape, et taux de passage d'une étape à la suivante.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnel.map((stage, i) => {
            const prev = i > 0 ? funnel[i - 1].count : null;
            const conv = prev != null ? pct(stage.count, prev) : null;
            return (
              <div key={stage.status} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-sm">{STATUS_LABEL[stage.status]}</div>
                <div className="h-7 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="flex h-full items-center rounded bg-primary/80 px-2 text-xs font-medium text-primary-foreground"
                    style={{
                      width: `${top > 0 ? Math.max((stage.count / top) * 100, stage.count > 0 ? 8 : 0) : 0}%`,
                    }}
                  >
                    {stage.count > 0 ? stage.count : ""}
                  </div>
                </div>
                <div className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                  {conv != null ? `${conv}%` : "—"}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Value by status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par statut</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {byStatus.map((b) => (
            <Badge key={b.status} variant="secondary" className="gap-1.5 py-1">
              {STATUS_LABEL[b.status]} · {b.count}
              {b.value > 0 && (
                <span className="text-muted-foreground">({eur.format(b.value)})</span>
              )}
              <span className="text-muted-foreground">
                · {Math.round(STATUS_PROBABILITY[b.status] * 100)}%
              </span>
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
