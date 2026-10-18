"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Sparkles,
  StickyNote,
} from "lucide-react";
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
  type: "created" | "status_change" | "note" | "email" | "whatsapp";
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
      return { icon: <Sparkles className="h-4 w-4" />, text: "Prospect créé" };
    case "status_change": {
      const labels = STATUS_LABEL as Record<string, string | undefined>;
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: `Statut → ${labels[a.body] ?? a.body}`,
      };
    }
    case "email":
      return {
        icon: <Mail className="h-4 w-4" />,
        text: `Email envoyé${a.body ? ` · ${a.body}` : ""}`,
      };
    case "whatsapp":
      return { icon: <MessageCircle className="h-4 w-4" />, text: a.body || "WhatsApp envoyé" };
    default:
      return { icon: <StickyNote className="h-4 w-4" />, text: a.body };
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

        {/* Note composer: a debossed field (same recipe as Input) and its action. */}
        <div className="flex flex-col gap-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ajouter une note (appel, échange, prochaine étape…)"
            className="flex min-h-[72px] w-full border border-input bg-card px-3 py-2 text-sm text-foreground shadow-inner transition-colors placeholder:italic placeholder:text-muted-foreground/70 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-end">
            <Button onClick={() => void addNote()} disabled={saving || !note.trim()}>
              <MessageSquarePlus className="h-4 w-4" />
              Ajouter une note
            </Button>
          </div>
        </div>

        {/* The history as a ledger: hairline-ruled entries, each led by its icon in a
            hairline square, the time as a lining caption under the line. */}
        <div className="space-y-2">
          <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
            Historique
          </p>
          <div className="max-h-[45vh] divide-y divide-border overflow-y-auto pr-1">
            {loading && items.length === 0 ? (
              <p className="py-6 text-center text-sm italic text-muted-foreground">Chargement…</p>
            ) : items.length === 0 ? (
              <p className="my-2 border border-dashed border-foreground/40 px-4 py-6 text-center text-sm italic text-muted-foreground">
                Aucune activité pour l'instant.
              </p>
            ) : (
              items.map((a) => {
                const { icon, text } = describe(a);
                return (
                  <div key={a.id} className="flex gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center border border-border bg-card text-muted-foreground">
                      {icon}
                    </span>
                    <div className="min-w-0 flex-1 pt-1.5">
                      <p className="whitespace-pre-wrap break-words text-sm leading-snug">{text}</p>
                      <p className="lining mt-1 text-xs text-muted-foreground">
                        {relTime(a.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
