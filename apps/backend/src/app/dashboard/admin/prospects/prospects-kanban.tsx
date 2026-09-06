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
    <div className="flex gap-3 overflow-x-auto pb-2">
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
              "flex w-64 shrink-0 flex-col rounded-lg border bg-muted/30 p-2 transition-colors",
              overCol === s && "ring-2 ring-primary"
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-medium">{STATUS_LABEL[s]}</span>
              <span className="text-xs text-muted-foreground">
                {col.length}
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
                      "group cursor-grab rounded-md border bg-background p-2.5 shadow-sm active:cursor-grabbing",
                      dragId === p.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-medium leading-tight">{p.company}</span>
                      {p.hasAccount && (
                        <Badge variant="success" className="shrink-0">
                          Inscrit
                        </Badge>
                      )}
                    </div>
                    {(p.contactName || p.email) && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.contactName || p.email}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {p.estimatedValueEur ? eur.format(p.estimatedValueEur) : ""}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          title="Envoyer un email"
                          disabled={!p.email}
                          onClick={() => onEmail(p)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => onEdit(p)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {due && (
                      <div className="mt-1.5 text-xs font-medium text-destructive">À relancer</div>
                    )}
                  </div>
                );
              })}
              {col.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
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
