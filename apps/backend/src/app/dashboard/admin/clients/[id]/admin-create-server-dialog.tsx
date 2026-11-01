"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { maxMcpsForBoxSize } from "@/lib/plan-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type BoxSize = "small" | "medium" | "large";

export function AdminCreateServerDialog({
  clientId,
  onDone,
}: {
  clientId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [boxSize, setBoxSize] = useState<BoxSize>("small");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Nom requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/admin/clients/${clientId}/servers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), boxSize }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(e.message);
      }
      toast.success("Serveur créé — provisioning en cours.");
      setName("");
      setBoxSize("small");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Échec de la création.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Créer un serveur
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un serveur pour ce client</DialogTitle>
            <DialogDescription>
              Une box cloud sera provisionnée au nom du client (TwinMCP Docs inclus). Vous pourrez
              ensuite y installer des MCPs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-server-name">Nom du serveur</Label>
              <Input
                id="admin-server-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production, Démo…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-server-size">Taille de la box</Label>
              <Select value={boxSize} onValueChange={(v) => setBoxSize(v as BoxSize)}>
                <SelectTrigger id="admin-server-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Capacities from lib/plan-features (never hand-typed). */}
                  <SelectItem value="small">
                    Small — jusqu’à {maxMcpsForBoxSize("small")} MCPs
                  </SelectItem>
                  <SelectItem value="medium">
                    Medium — jusqu’à {maxMcpsForBoxSize("medium")} MCPs
                  </SelectItem>
                  <SelectItem value="large">
                    Large — jusqu’à {maxMcpsForBoxSize("large")} MCPs
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void submit()} disabled={saving || !name.trim()}>
              {saving ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
