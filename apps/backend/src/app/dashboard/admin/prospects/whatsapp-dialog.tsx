"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
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

// Mirrors the approved Meta template body so the admin sees what goes out. The
// real send is server-side (lib/whatsapp.ts) — this is preview copy only.
function previewMessage(contactName: string, company: string): string {
  const name = contactName.trim() || "à vous";
  const co = company.trim() || "votre entreprise";
  return (
    `Bonjour ${name}, je suis le fondateur de TwinMCP. Nous aidons ${co} à connecter leurs ` +
    `assistants IA (comme ChatGPT ou Claude) à leurs outils internes, en toute sécurité. ` +
    `Seriez-vous ouvert(e) à un échange de 15 min pour en discuter ? Répondez STOP pour ne ` +
    `plus être contacté.`
  );
}

export function WhatsappQuickDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!phone.trim() || !company.trim()) {
      toast.error("Numéro et entreprise sont requis.");
      return;
    }
    setSending(true);
    try {
      const createRes = await fetch("/api/v2/admin/prospects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          contactName: contactName.trim() || null,
          phone: phone.trim(),
          source: "WhatsApp",
        }),
      });
      if (!createRes.ok) throw new Error("create");
      const prospect = (await createRes.json()) as { id: string };

      const waRes = await fetch(`/api/v2/admin/prospects/${prospect.id}/whatsapp`, {
        method: "POST",
      });
      if (waRes.ok) {
        toast.success(`Message WhatsApp envoyé à ${company.trim()}`);
      } else {
        // The prospect was created; only the send failed (e.g. not configured).
        const err = (await waRes.json().catch(() => ({}))) as { message?: string };
        toast.error(err.message ?? "Prospect créé, mais l'envoi WhatsApp a échoué.");
      }
      setPhone("");
      setContactName("");
      setCompany("");
      setOpen(false);
      onDone();
    } catch {
      toast.error("Échec de la création du prospect.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prospecter par WhatsApp</DialogTitle>
            <DialogDescription>
              Entrez un numéro : on crée le prospect et on envoie le message d'introduction (modèle
              approuvé par Meta), personnalisé.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="wa-phone">Numéro de téléphone *</Label>
              <Input
                id="wa-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="wa-company">Entreprise *</Label>
              <Input
                id="wa-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme SAS"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="wa-contact">Contact (optionnel)</Label>
              <Input
                id="wa-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Marie"
              />
            </div>
          </div>

          {/* The outgoing message as a preview card on the quiet fill, a brand
              rule down the left edge. */}
          <div className="overflow-hidden rounded-xl border border-border border-l-4 border-l-brand bg-secondary">
            <p className="border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground">
              Aperçu du message
            </p>
            <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">
              {previewMessage(contactName, company)}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              Annuler
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={sending || !phone.trim() || !company.trim()}
            >
              <Send aria-hidden />
              {sending ? "Envoi…" : "Créer + envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
