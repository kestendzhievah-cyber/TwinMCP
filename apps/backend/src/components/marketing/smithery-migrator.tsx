"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, ArrowRight, Check, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { buildServerUrl } from "@/lib/mcp/client-config";
import {
  planMigration,
  type MigrationCatalogueEntry,
  type MigrationPlan,
} from "@/lib/migrate/smithery";
import type { Locale } from "@/lib/i18n/locales";

// The interactive half of the Smithery migration assistant (EN /migrate, FR
// /fr/migrer): paste anything that names a Smithery server, get a plan. The
// server component (migrate-assistant.tsx) passes the catalogue and the offer
// copy, both built from the single sources of truth, so nothing here states a
// number of its own.

export interface MigratorOffer {
  cta: string;
  termsLine: string;
  signUpHref: string;
  /** "€10" / "10 €": the smallest top-up, for the plans that need one. */
  minTopup: string;
}

const CONTACT = "hello@twinmcp.fr";
const NNBSP = " "; // narrow no-break space before ; : ! ? » in French

const EXAMPLES = [
  { id: "url", value: "https://server.smithery.ai/@upstash/context7-mcp/mcp" },
  { id: "npx", value: "npx -y firecrawl-mcp" },
  {
    id: "yaml",
    value: `startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      apiKey:
        type: string
  commandFunction: |-
    (config) => ({ command: 'npx', args: ['-y', 'my-weather-mcp'], env: { API_KEY: config.apiKey } })`,
  },
] as const;

const COPY = {
  en: {
    label: "Your Smithery server",
    placeholder:
      "Paste its server.smithery.ai URL, its name (@owner/server), its npx / uvx command, its GitHub or npm link, or its smithery.yaml",
    try: "Try with:",
    examples: { url: "a Smithery URL", npx: "an npx command", yaml: "a smithery.yaml" },
    empty: "Your migration plan appears here as you paste.",
    catalogue: {
      exact: "In the TwinMCP catalogue",
      probable: "Probably in the catalogue",
      probableNote: (name: string) =>
        `We matched it by name. Check that ${name} is the server you ran on Smithery.`,
      free: "Installs on the free credit",
      topUp: (min: string) => `Waits for a first top-up of ${min}`,
      steps: [
        "Create your account.",
        "Create your server: the getting-started assistant does it in one click.",
        (name: string) => `In Marketplace, search for “${name}”, then Install.`,
        "Point your client at your new URL.",
      ],
      fields: "Fill in:",
      noFields: "No configuration needed.",
      yamlKeys: (keys: string) => `Your Smithery settings (${keys}) go into these fields.`,
    },
    publish: {
      badge: "Your own package",
      title: (pkg: string) => `${pkg} is not in the catalogue: publish it as is`,
      lead: "TwinMCP runs any npm or PyPI package in its own sandbox. Copy these fields into Publish MCP.",
      fields: { name: "Name", slug: "Slug", runtime: "Runtime", start: "Start command" },
      topUp: (min: string) =>
        `Publishing your own MCP unlocks with a first top-up of ${min}. It stays on your balance and pays for your usage.`,
      steps: [
        "Create your account.",
        "Make your first top-up.",
        "Dashboard → Publish MCP: paste the fields above.",
        "Install it on your server, then point your client at your new URL.",
      ],
      yamlKeys: (keys: string) =>
        `Declare your Smithery settings (${keys}) as config fields, and use them in the command as $NAME.`,
    },
    manual: {
      docker:
        "This server only ships as a Docker image. The TwinMCP sandbox runs npm and PyPI packages, so it cannot run as is.",
      noPackage: (qn?: string) =>
        qn
          ? `We do not know the package behind ${qn}. The Smithery registry stays online: open smithery.ai/server/${qn} and paste its npm or PyPI package, or its GitHub repository, here.`
          : "We did not find an npm or PyPI package. If the server is published, paste its package name or its npx / uvx command here.",
      unknown:
        "We could not read that. Paste a server.smithery.ai URL, an @owner/server name, an npx / uvx command or a smithery.yaml.",
      contact: "Write to us, we look at your migration with you",
    },
    url: {
      before: "Today (Smithery)",
      after: "Tomorrow (TwinMCP)",
      note: "Cursor, VS Code, Windsurf…: an API key from your account. Claude and ChatGPT: paste the URL and sign in (OAuth).",
    },
    server: "<your-server>",
    smitheryUrl: "https://server.smithery.ai/…",
  },
  fr: {
    label: "Ton serveur Smithery",
    placeholder:
      "Colle son URL server.smithery.ai, son nom (@owner/serveur), sa commande npx / uvx, son lien GitHub ou npm, ou son smithery.yaml",
    try: `Essayer avec${NNBSP}:`,
    examples: { url: "une URL Smithery", npx: "une commande npx", yaml: "un smithery.yaml" },
    empty: "Ton plan de migration s’affiche ici dès que tu colles quelque chose.",
    catalogue: {
      exact: "Dans le catalogue TwinMCP",
      probable: "Sûrement dans le catalogue",
      probableNote: (name: string) =>
        `Trouvé par son nom${NNBSP}: vérifie que ${name} est bien le serveur que tu utilisais sur Smithery.`,
      free: "S’installe avec le crédit offert",
      topUp: (min: string) => `Attend une première recharge de ${min}`,
      steps: [
        "Crée ton compte.",
        "Crée ton serveur : l’assistant de démarrage le fait en un clic.".replace(
          " :",
          `${NNBSP}:`
        ),
        (name: string) => `Dans Marketplace, cherche «${NNBSP}${name}${NNBSP}», puis Install.`,
        "Fais pointer ton client vers ta nouvelle URL.",
      ],
      fields: `À remplir${NNBSP}:`,
      noFields: "Aucune configuration à saisir.",
      yamlKeys: (keys: string) => `Tes paramètres Smithery (${keys}) vont dans ces champs.`,
    },
    publish: {
      badge: "Ton propre paquet",
      title: (pkg: string) => `${pkg} n’est pas dans le catalogue${NNBSP}: publie-le tel quel`,
      lead: "TwinMCP fait tourner n’importe quel paquet npm ou PyPI dans son propre sandbox. Copie ces champs dans Publish MCP.",
      fields: { name: "Nom", slug: "Slug", runtime: "Runtime", start: "Commande de démarrage" },
      topUp: (min: string) =>
        `La publication de ton propre MCP se débloque avec une première recharge de ${min}. Elle reste sur ton solde et paie ton usage.`,
      steps: [
        "Crée ton compte.",
        "Fais ta première recharge.",
        `Dashboard → Publish MCP${NNBSP}: colle les champs ci-dessus.`,
        "Installe-le sur ton serveur, puis fais pointer ton client vers ta nouvelle URL.",
      ],
      yamlKeys: (keys: string) =>
        `Déclare tes paramètres Smithery (${keys}) comme champs de configuration, et utilise-les dans la commande avec $NOM.`,
    },
    manual: {
      docker:
        "Ce serveur n’existe qu’en image Docker. Le sandbox TwinMCP exécute des paquets npm et PyPI, il ne peut donc pas le faire tourner tel quel.",
      noPackage: (qn?: string) =>
        qn
          ? `On ne connaît pas le paquet derrière ${qn}. Le registre Smithery reste en ligne${NNBSP}: ouvre smithery.ai/server/${qn} et colle ici son paquet npm ou PyPI, ou son dépôt GitHub.`
          : `On n’a pas trouvé de paquet npm ou PyPI. Si le serveur est publié, colle ici le nom de son paquet ou sa commande npx / uvx.`,
      unknown:
        "On n’a pas réussi à lire ça. Colle une URL server.smithery.ai, un nom @owner/serveur, une commande npx / uvx ou un smithery.yaml.",
      contact: "Écris-nous, on regarde ta migration avec toi",
    },
    url: {
      before: "Aujourd’hui (Smithery)",
      after: "Demain (TwinMCP)",
      note: `Cursor, VS Code, Windsurf…${NNBSP}: une clé API de ton compte. Claude et ChatGPT${NNBSP}: colle l’URL et connecte-toi (OAuth).`,
    },
    server: "<ton-serveur>",
    smitheryUrl: "https://server.smithery.ai/…",
  },
} as const;

function mailto(locale: Locale, input: string): string {
  const subject = locale === "fr" ? "Migration Smithery" : "Smithery migration";
  const body =
    (locale === "fr" ? "Mon serveur Smithery :\n\n" : "My Smithery server:\n\n") +
    input.slice(0, 1500);
  return `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Steps({ items }: { items: readonly React.ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">{item}</div>
        </li>
      ))}
    </ol>
  );
}

function SignUp({ offer }: { offer: MigratorOffer }) {
  return (
    <div className="mt-3">
      <Button asChild size="lg">
        <Link href={offer.signUpHref as Route}>
          {offer.cta}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{offer.termsLine}</p>
    </div>
  );
}

function UrlSwap({
  locale,
  plan,
  siteUrl,
}: {
  locale: Locale;
  plan: Exclude<MigrationPlan, { route: "empty" }>;
  siteUrl: string;
}) {
  const t = COPY[locale];
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-surface-alt p-3">
        <p className="text-xs font-semibold text-muted-foreground">{t.url.before}</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground line-through">
          {plan.smitheryUrl ?? t.smitheryUrl}
        </p>
      </div>
      <div className="rounded-lg border border-success/30 bg-success/10 p-3">
        <p className="text-xs font-semibold text-success">{t.url.after}</p>
        <p className="mt-1 break-all font-mono text-xs text-foreground">
          {buildServerUrl(siteUrl, t.server)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">{t.url.note}</p>
    </div>
  );
}

function ContactButton({ locale, input }: { locale: Locale; input: string }) {
  return (
    <Button asChild variant="outline" className="mt-4">
      <a href={mailto(locale, input)}>
        <Mail aria-hidden />
        {COPY[locale].manual.contact}
      </a>
    </Button>
  );
}

function Result({
  locale,
  plan,
  input,
  offer,
  siteUrl,
}: {
  locale: Locale;
  plan: MigrationPlan;
  input: string;
  offer: MigratorOffer;
  siteUrl: string;
}) {
  const t = COPY[locale];
  if (plan.route === "empty") {
    return (
      <p className="rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {t.empty}
      </p>
    );
  }

  if (plan.route === "catalogue") {
    const { entry } = plan;
    const required = entry.config.filter((f) => f.required);
    const c = t.catalogue;
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={plan.confidence === "exact" ? "success" : "warning"}>
              {plan.confidence === "exact" ? c.exact : c.probable}
            </Badge>
            {entry.needsTopUp ? (
              <Badge variant="offer">{c.topUp(offer.minTopup)}</Badge>
            ) : (
              <Badge variant="brand">{c.free}</Badge>
            )}
          </div>
          <CardTitle className="mt-2 text-xl">{entry.name}</CardTitle>
          {plan.confidence === "probable" && (
            <CardDescription className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              {c.probableNote(entry.name)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Steps
            items={[
              <>
                {c.steps[0]}
                <SignUp offer={offer} />
              </>,
              c.steps[1],
              <>
                {c.steps[2](entry.name)}
                <div className="mt-2 rounded-lg border border-border bg-surface-alt p-3">
                  {required.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{c.noFields}</p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground">{c.fields}</p>
                      <ul className="mt-1 space-y-1">
                        {required.map((f) => (
                          <li key={f.key} className="text-xs">
                            <span className="font-mono font-semibold text-foreground">{f.key}</span>
                            {f.description ? (
                              <span className="text-muted-foreground"> · {f.description}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {plan.yamlKeys.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.yamlKeys(plan.yamlKeys.join(", "))}
                    </p>
                  )}
                </div>
              </>,
              <>
                {c.steps[3]}
                <UrlSwap locale={locale} plan={plan} siteUrl={siteUrl} />
              </>,
            ]}
          />
        </CardContent>
      </Card>
    );
  }

  if (plan.route === "publish") {
    const p = t.publish;
    const fields = `name:    ${plan.name}\nslug:    ${plan.slug}\nruntime: ${plan.runtime}\nstart:   ${plan.startCmd}`;
    return (
      <Card>
        <CardHeader>
          <Badge variant="info" className="w-fit">
            {p.badge}
          </Badge>
          <CardTitle className="mt-2 text-xl break-words">{p.title(plan.pkg)}</CardTitle>
          <CardDescription>{p.lead}</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeSnippet code={fields} language="yaml" filename="Publish MCP" />
          {plan.yamlKeys.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {p.yamlKeys(plan.yamlKeys.join(", "))}
            </p>
          )}
          <p className="mt-3 rounded-lg border border-offer-border bg-offer p-3 text-sm text-offer-foreground">
            {p.topUp(offer.minTopup)}
          </p>
          <Steps
            items={[
              <>
                {p.steps[0]}
                <SignUp offer={offer} />
              </>,
              p.steps[1],
              p.steps[2],
              <>
                {p.steps[3]}
                <UrlSwap locale={locale} plan={plan} siteUrl={siteUrl} />
              </>,
            ]}
          />
        </CardContent>
      </Card>
    );
  }

  const m = t.manual;
  const text =
    plan.reason === "docker"
      ? m.docker
      : plan.reason === "no-package"
        ? m.noPackage(plan.qualifiedName)
        : m.unknown;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          {text}
        </p>
        <ContactButton locale={locale} input={input} />
      </CardContent>
    </Card>
  );
}

export function SmitheryMigrator({
  locale = "en",
  catalogue,
  offer,
  siteUrl,
}: {
  locale?: Locale;
  catalogue: MigrationCatalogueEntry[];
  offer: MigratorOffer;
  siteUrl: string;
}) {
  const t = COPY[locale];
  const [input, setInput] = useState("");
  const plan = useMemo(() => planMigration(input, catalogue), [input, catalogue]);
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 text-left lg:grid-cols-2">
      <div>
        <Label htmlFor="smithery-input">{t.label}</Label>
        <Textarea
          id="smithery-input"
          className="mt-2 min-h-[160px] font-mono text-sm"
          placeholder={t.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{t.try}</span>
          {EXAMPLES.map((ex) => (
            <Button
              key={ex.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInput(ex.value)}
            >
              {t.examples[ex.id]}
            </Button>
          ))}
        </div>
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          {(locale === "fr"
            ? [
                "Rien ne quitte ton navigateur : l’analyse se fait sur cette page.",
                "Même paquet MCP, même code : seul l’hébergement change.",
                "Secrets chiffrés, un sandbox isolé par serveur.",
              ]
            : [
                "Nothing leaves your browser: the analysis runs on this page.",
                "Same MCP package, same code: only the hosting moves.",
                "Encrypted secrets, one isolated sandbox per server.",
              ]
          ).map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              {locale === "fr" ? line.replace(" :", `${NNBSP}:`) : line}
            </li>
          ))}
        </ul>
      </div>
      <div aria-live="polite">
        <Result locale={locale} plan={plan} input={input} offer={offer} siteUrl={siteUrl} />
      </div>
    </div>
  );
}
