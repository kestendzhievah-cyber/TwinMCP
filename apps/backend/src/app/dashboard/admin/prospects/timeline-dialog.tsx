"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Mail, MessageSquarePlus, Sparkles, StickyNote } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, type ProspectRow } from "./prospects-shared";

interface Activity {
  id: string;
  type: "created" | "status_change" | "note" | "email";
  body: string;
  createdAt: string;
}

function relTime(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

function describe(a: Activity): { icon: React.ReactNode; text: string } {
  switch (a.type) {
    case "created":
      return { icon: <Sparkles className="h-3.5 w-3.5" />, text: "Prospect créé" };
    case "status_change": {
      const labels = STATUS_LABEL as Record<string, string | undefined>;
      return {
        icon: <ArrowRight className="h-3.5 w-3.5" />,
        text: `Statut → ${labels[a.body] ?? a.body}`,
      };
    }
    case "email":
      return {
        icon: <Mail className="h-3.5 w-3.5" />,
        text: `Email envoyé${a.body ? ` · ${a.body}` : ""}`,
      };
    default:
      return { icon: <StickyNote className="h-3.5 w-3.5" />, text: a.body };
  }
}

export function TimelineDialog({
  prospect,
  open,
  onOpenChange,
}: {
  prospect: ProspectRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/admin/prospects/${id}/activities`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { items: Activity[] };
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && prospect) {
      setNote("");
      void load(prospect.id);
    }
  }, [open, prospect, load]);

  async function addNote() {
    if (!prospect || !note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/admin/prospects/${prospect.id}/activities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "note", body: note.trim() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setNote("");
      await load(prospect.id);
    } catch {
      toast.error("Échec de l'ajout de la note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prospect?.company ?? "Timeline"}</DialogTitle>
          <DialogDescription>Historique des interactions et notes.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ajouter une note (appel, échange, prochaine étape…)"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void addNote()} disabled={saving || !note.trim()}>
              <MessageSquarePlus className="h-4 w-4" />
              Ajouter une note
            </Button>
          </div>
        </div>

        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {loading && items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucune activité pour l'instant.
            </p>
          ) : (
            items.map((a) => {
              const { icon, text } = describe(a);
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
                    <p className="text-xs text-muted-foreground">{relTime(a.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
