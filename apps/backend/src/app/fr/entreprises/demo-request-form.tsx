"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const INPUT =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20";

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
      <div className="rounded-2xl border border-emerald-600/30 bg-emerald-600/[0.04] p-8 text-center md:p-10">
        <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600 dark:text-emerald-400" />
        <h3 className="mt-4 text-xl font-semibold tracking-tight">Merci — c'est bien reçu !</h3>
        <p className="mt-2 text-muted-foreground">
          On revient vers vous très vite pour organiser une démo adaptée à vos outils.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
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

      <div className="sm:col-span-2">
        <label htmlFor="demo-company" className="mb-1.5 block text-sm font-medium">
          Entreprise <span className="text-muted-foreground">*</span>
        </label>
        <input
          id="demo-company"
          required
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          className={INPUT}
          placeholder="Acme SAS"
        />
      </div>

      <div>
        <label htmlFor="demo-name" className="mb-1.5 block text-sm font-medium">
          Votre nom
        </label>
        <input
          id="demo-name"
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          className={INPUT}
          placeholder="Marie Dupont"
        />
      </div>

      <div>
        <label htmlFor="demo-email" className="mb-1.5 block text-sm font-medium">
          Email professionnel <span className="text-muted-foreground">*</span>
        </label>
        <input
          id="demo-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={INPUT}
          placeholder="marie@acme.fr"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="demo-message" className="mb-1.5 block text-sm font-medium">
          Votre besoin <span className="text-muted-foreground">(optionnel)</span>
        </label>
        <textarea
          id="demo-message"
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className={INPUT}
          placeholder="Quels outils souhaitez-vous connecter à l'IA ?"
        />
      </div>

      <div className="flex flex-col items-start gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:bg-foreground/90 disabled:opacity-60"
        >
          {status === "sending" ? "Envoi…" : "Demander une démo"}
          {status !== "sending" && <ArrowRight className="h-4 w-4" />}
        </button>
        {status === "error" && (
          <p className="text-sm text-destructive">
            Une erreur est survenue. Réessayez, ou écrivez-nous directement.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Réponse sous 24 h ouvrées. Aucune carte bancaire, aucun engagement.
        </p>
      </div>
    </form>
  );
}
