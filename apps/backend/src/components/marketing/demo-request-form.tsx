"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/lib/i18n/locales";
import { trackDemoConversion } from "@/lib/analytics/google-ads";
import { track } from "@/lib/analytics/funnel";
import {
  DEMO_CLIENTS,
  DEMO_GOAL_MAX,
  DEMO_TOPICS,
  HONEYPOT_FIELD,
  TEAM_SIZES,
  demoClientLabel,
  demoTopicLabel,
  demoTopicNeedsCompany,
  type DemoClient,
  type DemoTopic,
  type TeamSize,
} from "@/lib/sales/demo-request";

// The guided-setup request form (/demo, /fr/demo). Posts to
// /api/v2/contact-sales, which validates with the same schema
// (lib/sales/demo-request.ts), rate-limits by IP and by address, stores the
// request in the prospection CRM, notifies the owner and sends the requester a
// one-off acknowledgement. On success: the consent-gated Google Ads "demo"
// conversion and the PostHog funnel event.

const COPY = {
  en: {
    title: "Request a guided setup",
    description: "Tell us what you want your AI client to do. We answer every request by email.",
    topic: "What is this about?",
    name: "Your name",
    email: "Work email",
    company: "Company",
    teamSize: "Team size",
    teamSizeOptions: {
      "1": "Just me",
      "2-10": "2 to 10 people",
      "11-50": "11 to 50 people",
      "51-200": "51 to 200 people",
      "200+": "More than 200 people",
    } satisfies Record<TeamSize, string>,
    clients: "AI client(s) you use",
    clientsHint: "Tick all that apply.",
    required: "Fields marked * are required.",
    optional: "(optional)",
    goal: "What do you want to automate?",
    pack: "Pack",
    packRemove: "Not this pack",
    goalPlaceholder:
      "e.g. let Claude read our Notion and open GitHub issues; query our Postgres from Cursor…",
    consent:
      "I agree that TwinMCP uses these details only to answer this request. They are kept in our request log so we can follow up, and deleted on request.",
    privacy: "Privacy policy",
    privacyHref: "/legal/en/privacy",
    submit: "Send my request",
    sending: "Sending…",
    honeypot: "Leave this field empty",
    doneTitle: "Thank you, your request is in.",
    doneBody: "We will reply to",
    doneNote:
      "A confirmation email should arrive shortly. Nothing else will be sent to this address.",
    errInvalid: "Please check the required fields and tick the consent box.",
    errRate: "Too many requests from this connection. Please try again in a few minutes.",
    errOther: "Something went wrong. Please email hello@twinmcp.fr.",
    errNetwork: "Network error. Please try again or email hello@twinmcp.fr.",
  },
  fr: {
    title: "Demander une installation accompagnée",
    description:
      "Dites-nous ce que votre client IA doit faire. Chaque demande reçoit une réponse par e-mail.",
    topic: "Objet de la demande",
    name: "Votre nom",
    email: "E-mail professionnel",
    company: "Entreprise",
    teamSize: "Taille de l’équipe",
    teamSizeOptions: {
      "1": "Moi seul(e)",
      "2-10": "2 à 10 personnes",
      "11-50": "11 à 50 personnes",
      "51-200": "51 à 200 personnes",
      "200+": "Plus de 200 personnes",
    } satisfies Record<TeamSize, string>,
    clients: "Client(s) IA utilisé(s)",
    clientsHint: "Cochez tout ce qui s’applique.",
    required: "Les champs marqués d’un * sont obligatoires.",
    optional: "(facultatif)",
    goal: "Que voulez-vous automatiser ?",
    pack: "Pack",
    packRemove: "Pas ce pack",
    goalPlaceholder:
      "ex. laisser Claude lire notre Notion et ouvrir des tickets GitHub ; interroger notre Postgres depuis Cursor…",
    consent:
      "J’accepte que TwinMCP utilise ces informations uniquement pour répondre à cette demande. Elles sont conservées dans notre registre des demandes pour assurer le suivi, et supprimées sur simple demande.",
    privacy: "Politique de confidentialité",
    privacyHref: "/legal/privacy",
    submit: "Envoyer ma demande",
    sending: "Envoi…",
    honeypot: "Laissez ce champ vide",
    doneTitle: "Merci, votre demande est bien reçue.",
    doneBody: "Nous vous répondrons à",
    doneNote:
      "Un e-mail de confirmation devrait arriver sous peu. Rien d’autre ne sera envoyé à cette adresse.",
    errInvalid: "Vérifiez les champs obligatoires et cochez la case de consentement.",
    errRate: "Trop de demandes depuis cette connexion. Réessayez dans quelques minutes.",
    errOther: "Une erreur est survenue. Écrivez-nous à hello@twinmcp.fr.",
    errNetwork: "Erreur réseau. Réessayez ou écrivez-nous à hello@twinmcp.fr.",
  },
} as const;

// Same debossed field as the Input primitive, for the select and the textarea.
const FIELD =
  "flex w-full border border-input bg-card px-3 text-sm text-foreground shadow-inner transition-colors placeholder:italic placeholder:text-muted-foreground/70 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-0";

/** The MCP pack the visitor came from (/solutions/<pack> → /demo?bundle=<id>). */
export interface DemoPack {
  id: string;
  name: string;
  mcps: string[];
}

export function DemoRequestForm({
  locale = "en",
  initialTopic = "setup",
  initialPack,
}: {
  locale?: Locale;
  initialTopic?: DemoTopic;
  initialPack?: DemoPack;
}) {
  const t = COPY[locale];
  const [pack, setPack] = useState<DemoPack | undefined>(initialPack);
  const [topic, setTopic] = useState<DemoTopic>(initialTopic);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState<TeamSize | "">("");
  const [clients, setClients] = useState<DemoClient[]>([]);
  const [goal, setGoal] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const needsCompany = demoTopicNeedsCompany(topic);
  // A pack only means something for a guided setup, not a DPA or security request.
  const bundle = topic === "setup" ? pack?.id : undefined;

  // WCAG 4.1.3: the form unmounts on success, so move focus to the result
  // (announced through role="status") instead of leaving it on <body>.
  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  const bad = (field: string) => (invalid.has(field) ? true : undefined);

  function toggleClient(c: DemoClient, on: boolean) {
    setClients((prev) => (on ? [...prev, c] : prev.filter((x) => x !== c)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const missing = new Set<string>();
    if (!consent) missing.add("consent");
    if (needsCompany && !teamSize) missing.add("teamSize");
    if (needsCompany && !company.trim()) missing.add("company");
    setInvalid(missing);
    if (missing.size > 0) {
      setError(t.errInvalid);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/contact-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company: needsCompany ? company : company.trim() || undefined,
          teamSize: teamSize || undefined,
          clients,
          goal,
          consent,
          topic,
          locale,
          bundle,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });
      if (res.ok) {
        // No enhanced-conversion email hash: the consent above limits the
        // details to answering the request, so none of them go to Google.
        trackDemoConversion();
        track({
          name: "demo_requested",
          properties: { locale, topic, teamSize, clients: clients.length, bundle },
        });
        setDone(true);
        return;
      }
      if (res.status === 400) {
        const err = (await res.json().catch(() => ({}))) as { fields?: unknown };
        if (Array.isArray(err.fields)) setInvalid(new Set(err.fields.map(String)));
      }
      setError(res.status === 400 ? t.errInvalid : res.status === 429 ? t.errRate : t.errOther);
    } catch {
      setError(t.errNetwork);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 px-6 py-12 text-center"
        >
          <div className="grid h-12 w-12 place-items-center border border-success/40 bg-success/10 text-success">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <h2
            ref={doneHeading}
            tabIndex={-1}
            className="smallcaps tracking-sc text-xl font-medium focus:outline-none"
          >
            {t.doneTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.doneBody} <span className="font-mono text-foreground">{email}</span>.
          </p>
          <p className="text-sm italic text-muted-foreground">{t.doneNote}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader className="border-b border-border">
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
        <p className="text-xs italic text-muted-foreground">{t.required}</p>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="demo-topic">{t.topic}</Label>
            <select
              id="demo-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value as DemoTopic)}
              className={`${FIELD} h-10`}
            >
              {DEMO_TOPICS.map((tp) => (
                <option key={tp} value={tp}>
                  {demoTopicLabel(tp, locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="demo-name">
                {t.name}
                <Req />
              </Label>
              <Input
                id="demo-name"
                autoComplete="name"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={bad("name")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">
                {t.email}
                <Req />
              </Label>
              <Input
                id="demo-email"
                type="email"
                autoComplete="email"
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={bad("email")}
                required
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="demo-company">
                {t.company}
                {needsCompany ? <Req /> : <Opt label={t.optional} />}
              </Label>
              <Input
                id="demo-company"
                autoComplete="organization"
                maxLength={200}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                aria-invalid={bad("company")}
                required={needsCompany}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-team">
                {t.teamSize}
                {needsCompany ? <Req /> : <Opt label={t.optional} />}
              </Label>
              <select
                id="demo-team"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value as TeamSize | "")}
                className={`${FIELD} h-10`}
                aria-invalid={bad("teamSize")}
                required={needsCompany}
              >
                <option value="" disabled={needsCompany}>
                  —
                </option>
                {TEAM_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {t.teamSizeOptions[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2" aria-describedby="demo-clients-hint">
            <legend className="text-sm font-medium leading-none">{t.clients}</legend>
            <p id="demo-clients-hint" className="text-xs italic text-muted-foreground">
              {t.clientsHint}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 sm:grid-cols-4">
              {DEMO_CLIENTS.map((c) => (
                <label key={c} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={clients.includes(c)}
                    onChange={(e) => toggleClient(c, e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-foreground"
                  />
                  <span>{demoClientLabel(c, locale)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {bundle && pack ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border border-border px-3 py-2 text-sm">
              <p>
                <span className="smallcaps tracking-sc text-muted-foreground">{t.pack}</span>{" "}
                <span className="font-medium">{pack.name}</span>{" "}
                <span className="text-muted-foreground">({pack.mcps.join(", ")})</span>
              </p>
              <button
                type="button"
                onClick={() => setPack(undefined)}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {t.packRemove}
              </button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="demo-goal">
              {t.goal}
              <Req />
            </Label>
            <textarea
              id="demo-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className={`${FIELD} min-h-[120px] py-2`}
              maxLength={DEMO_GOAL_MAX}
              placeholder={t.goalPlaceholder}
              aria-invalid={bad("goal")}
              required
            />
          </div>

          {/* Honeypot: off-screen and out of the tab order; a bot that fills it
              gets a 200 and nothing is stored. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={`demo-${HONEYPOT_FIELD}`}>{t.honeypot}</label>
            <input
              id={`demo-${HONEYPOT_FIELD}`}
              name={HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-foreground"
              aria-invalid={bad("consent")}
              required
            />
            <span>
              {t.consent}
              <Req />{" "}
              <Link
                href={t.privacyHref as Route}
                className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
              >
                {t.privacy}
              </Link>
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t.sending : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Required-field marker (the "*" legend sits under the card description). */
function Req() {
  return (
    <span aria-hidden className="ml-0.5 text-muted-foreground">
      *
    </span>
  );
}

function Opt({ label }: { label: string }) {
  return <span className="ml-1 text-xs font-normal italic text-muted-foreground">{label}</span>;
}
