"use client";

import { useState } from "react";
import { Mail, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STATUSES,
  STATUS_LABEL,
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
    // The board is one sheet of stock ruled into columns (DESIGN.md §5 Kanban):
    // hairlines between columns, small-caps titles with lining counts, plain
    // bone cards inside. The hovered drop column darkens like a hover surface.
    <div className="flex divide-x divide-border overflow-x-auto border border-border">
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
              "flex w-64 shrink-0 flex-col p-3 transition-colors",
              overCol === s && "bg-secondary/70"
            )}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-border pb-2">
              <span className="smallcaps tracking-sc text-sm font-medium">{STATUS_LABEL[s]}</span>
              <span className="lining text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{col.length}</span>
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
                      "group cursor-grab border border-border bg-card p-3 transition-colors hover:border-foreground/60 active:cursor-grabbing",
                      dragId === p.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">{p.company}</span>
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
                      <span className="lining text-xs text-muted-foreground">
                        {p.estimatedValueEur ? eur.format(p.estimatedValueEur) : ""}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          title="Envoyer un email"
                          disabled={!p.email}
                          onClick={() => onEmail(p)}
                          className="grid h-10 w-10 place-items-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-40"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => onEdit(p)}
                          className="grid h-10 w-10 place-items-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {due && (
                      <div className="smallcaps tracking-sc mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />À
                        relancer
                      </div>
                    )}
                  </div>
                );
              })}
              {col.length === 0 && (
                <div className="border border-dashed border-foreground/40 p-3 text-center text-xs italic text-muted-foreground">
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
