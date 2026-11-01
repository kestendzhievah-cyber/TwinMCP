"use client";

import { useState } from "react";
import { AlertTriangle, Mail, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STATUSES,
  STATUS_LABEL,
  STATUS_VARIANT,
  eur,
  isDue,
  type ProspectRow,
  type Status,
} from "./prospects-shared";

export function ProspectsKanban({
  items,
  nowMs,
  onStatusChange,
  onEdit,
  onEmail,
}: {
  items: ProspectRow[];
  nowMs: number;
  onStatusChange: (id: string, status: Status) => void;
  onEdit: (p: ProspectRow) => void;
  onEmail: (p: ProspectRow) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  return (
    // Kanban (spec §6): light-blue rounded columns, white cards with a soft
    // shadow, the stage as a tinted badge; the hovered drop column gets a
    // brand ring. Scrolls sideways inside itself, never the page.
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {STATUSES.map((s) => {
        const col = items.filter((p) => p.status === s);
        const sum = col.reduce((a, p) => a + p.estimatedValueEur, 0);
        return (
          <div
            key={s}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(s);
            }}
            onDragLeave={() => setOverCol((c) => (c === s ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) onStatusChange(dragId, s);
              setDragId(null);
              setOverCol(null);
            }}
            className={cn(
              "flex w-64 shrink-0 flex-col rounded-2xl bg-surface-alt p-3 transition-shadow",
              overCol === s && "ring-2 ring-brand/40"
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>
              <span className="text-xs tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{col.length}</span>
                {sum > 0 ? ` · ${eur.format(sum)}` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {col.map((p) => {
                const due = isDue(p, nowMs);
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      "group cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-input hover:shadow-md active:cursor-grabbing",
                      dragId === p.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug">{p.company}</span>
                      {p.hasAccount && (
                        <Badge variant="success" className="shrink-0">
                          Inscrit
                        </Badge>
                      )}
                    </div>
                    {(p.contactName || p.email) && (
                      <div
                        className={cn(
                          "mt-0.5 truncate text-xs text-muted-foreground",
                          !p.contactName && "font-mono"
                        )}
                      >
                        {p.contactName || p.email}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {p.estimatedValueEur ? eur.format(p.estimatedValueEur) : ""}
                      </span>
                      {/* Hover-revealed on pointers; always visible on touch screens. */}
                      <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                        <button
                          type="button"
                          title="Envoyer un email"
                          aria-label={`Envoyer un email à ${p.company}`}
                          disabled={!p.email}
                          onClick={() => onEmail(p)}
                          className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                        >
                          <Mail aria-hidden className="size-4" />
                        </button>
                        <button
                          type="button"
                          title="Modifier"
                          aria-label={`Modifier ${p.company}`}
                          onClick={() => onEdit(p)}
                          className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Pencil aria-hidden className="size-4" />
                        </button>
                      </div>
                    </div>
                    {due && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                        <AlertTriangle aria-hidden className="size-3.5 shrink-0" />À relancer
                      </div>
                    )}
                  </div>
                );
              })}
              {col.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  Glissez une carte ici
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
