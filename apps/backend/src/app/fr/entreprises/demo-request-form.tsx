"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Same debossed field as the Input primitive, grown for a few lines.
const TEXTAREA =
  "flex min-h-[96px] w-full border border-input bg-card px-3 py-2 text-sm text-foreground shadow-inner transition-colors placeholder:italic placeholder:text-muted-foreground/70 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-0";

type Status = "idle" | "sending" | "done" | "error";

export function DemoRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    email: "",
    message: "",
    website: "", // honeypot
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/v2/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        {/* Success is the tint recipe: hairline square, 10% green, green ink. */}
        <div className="grid h-12 w-12 place-items-center border border-success/40 bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="smallcaps tracking-sc text-xl font-medium">Merci — c'est bien reçu !</h3>
        <p className="text-sm text-muted-foreground">
          On revient vers vous très vite pour organiser une démo adaptée à vos outils.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      {/* Honeypot — hidden off-screen; only bots fill it. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="demo-company">
          Entreprise <span className="text-muted-foreground">*</span>
        </Label>
        <Input
          id="demo-company"
          required
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          placeholder="Acme SAS"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="demo-name">Votre nom</Label>
        <Input
          id="demo-name"
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          placeholder="Marie Dupont"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="demo-email">
          Email professionnel <span className="text-muted-foreground">*</span>
        </Label>
        <Input
          id="demo-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="marie@acme.fr"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="demo-message">
          Votre besoin <span className="font-normal text-muted-foreground">(optionnel)</span>
        </Label>
        <textarea
          id="demo-message"
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className={TEXTAREA}
          placeholder="Quels outils souhaitez-vous connecter à l'IA ?"
        />
      </div>

      <div className="flex flex-col items-start gap-3 sm:col-span-2">
        <Button type="submit" disabled={status === "sending"} className="w-full sm:w-auto">
          {status === "sending" ? "Envoi…" : "Demander une démo"}
          {status !== "sending" && <ArrowRight className="h-4 w-4" />}
        </Button>
        {status === "error" && (
          <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Une erreur est survenue. Réessayez, ou écrivez-nous directement.</span>
          </p>
        )}
        <p className="text-xs italic text-muted-foreground">
          Réponse sous 24 h ouvrées. Aucune carte bancaire, aucun engagement.
        </p>
      </div>
    </form>
  );
}
