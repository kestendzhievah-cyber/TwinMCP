import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, ExternalLink, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Section } from "@/components/marketing/section";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { Faq } from "@/components/marketing/faq";
import { PLANS, formatPrice } from "@/components/pricing/pricing-data";
import {
  API_KEY_PLACEHOLDER,
  buildClientConfig,
  buildServerUrl,
  serverConfigLabel,
  type IdeKey,
} from "@/lib/mcp/client-config";
import { PLAN_CAPABILITIES, PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";
import { CATALOGUE_COUNT, getComparison } from "@/lib/compare/data";
import type { Locale } from "@/lib/i18n/locales";

// The Smithery migration landing (EN /migrate-from-smithery, FR
// /fr/migrer-depuis-smithery). Every section takes a `locale` prop; the page
// files only add metadata, JSON-LD and server-side page tracking.
//
// Facts policy: Smithery's shutdown facts are not restated here. They come from
// the sourced Smithery comparison in lib/compare/data.ts (itself from
// https://smithery.ai/future): connection services, server URLs on run.tools
// and server.smithery.ai, the API, Connect and Toolbox, accounts and API keys,
// the CLI and SDKs stop on 31 October 2026; the public registry stays.
// TwinMCP facts come from lib/plan-features.ts, lib/rate-limit.ts,
// lib/mcp/client-config.ts (one URL per server, recommended; per-MCP URLs
// still available), lib/auth/key-scope.ts (account keys, full or mcp_proxy,
// optionally bound to one server), lib/vault (shared {{secret:NAME}} values)
// and components/pricing/pricing-data.ts. No SLA, no region choice, no team
// sharing, no always-on promise.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
export const SMITHERY_FUTURE_URL = "https://smithery.ai/future";

export const MIGRATION_PATHS = {
  en: "/migrate-from-smithery",
  fr: "/fr/migrer-depuis-smithery",
} as const satisfies Record<Locale, string>;

const SIGN_UP = { en: "/sign-up", fr: "/fr/inscription" } as const satisfies Record<Locale, string>;

function signUpHref(locale: Locale, plan: "free" | "pro"): Route {
  return `${SIGN_UP[locale]}?plan=${plan}` as Route;
}

// Plan facts, derived from the single sources of truth so the copy cannot drift.
const free = PLAN_CAPABILITIES.free;
const pro = PLAN_CAPABILITIES.pro;
const freePlan = PLANS.find((p) => p.id === "free")!;
const proPlan = PLANS.find((p) => p.id === "pro")!;
const PRO_YEARLY_EUR = Math.round(proPlan.annualMonthlyUsd * 12);
const FREE_DAILY = getDailyLimit("free");
const PRO_DAILY = getDailyLimit("pro");

// ─── Smithery shutdown facts (single source: lib/compare/data.ts) ────────────

const SMITHERY = getComparison("smithery");
if (!SMITHERY) throw new Error("lib/compare/data.ts has no Smithery comparison");
const SMITHERY_ROWS = SMITHERY.rows;
const SMITHERY_FAQ = SMITHERY.faq;

/** What stops on 31 October, then what stays, in the order the page lists them. */
const SHUTDOWN_ROWS = [
  { id: "status", en: "Hosting and connections", fr: "Hébergement et connexions" },
  { id: "url", en: "Server URLs", fr: "URL des serveurs" },
  { id: "accounts", en: "Accounts and API keys", fr: "Comptes et clés API" },
  { id: "tooling", en: "CLI and SDKs", fr: "CLI et SDK" },
  { id: "registry", en: "Registry (stays online)", fr: "Registre (reste en ligne)" },
] as const;

/**
 * The shutdown ledger rows for a locale: our label, Smithery's fact as worded
 * (and sourced) in the comparison data. Throws if a row disappears there, so
 * the page cannot silently drop a fact.
 */
export function smitheryShutdownRows(locale: Locale): { name: string; body: string }[] {
  return SHUTDOWN_ROWS.map((r) => {
    const row = SMITHERY_ROWS.find((x) => x.id === r.id);
    if (!row) throw new Error(`Smithery comparison has no "${r.id}" row`);
    return { name: r[locale], body: row.them[locale] };
  });
}

/** The comparison's "what exactly stops" answer, reused by the migration FAQ. */
export function smitheryShutdownScope(locale: Locale): string {
  const item = SMITHERY_FAQ[locale][0];
  if (!item) throw new Error("Smithery comparison has no FAQ");
  return item.a;
}

// Placeholders for the client snippets. The URL shape is the real one (same
// buildServerUrl() the dashboard uses); only the slugs and the key are examples.
const EXAMPLE = {
  en: { server: "my-server", mcp: "notion" },
  fr: { server: "mon-serveur", mcp: "notion" },
} as const;

const SNIPPET_CLIENTS: IdeKey[] = ["cursor", "claude-code", "windsurf", "vscode"];
const CLIENT_NAMES: Record<string, string> = {
  cursor: "Cursor",
  "claude-code": "Claude Code",
  windsurf: "Windsurf",
  vscode: "VS Code",
};

// The recommended connection: one URL for the whole server (every installed
// MCP behind it, tools named <mcp>__<tool>). Per-MCP URLs stay available.
function exampleUrl(locale: Locale, placeholders = false): string {
  return buildServerUrl(
    SITE_URL,
    placeholders ? (locale === "fr" ? "<serveur>" : "<server>") : EXAMPLE[locale].server
  );
}

// ─── Copy ────────────────────────────────────────────────────────────────────

const COPY = {
  en: {
    hero: {
      eyebrow: "Smithery migration",
      title:
        "Smithery shuts down on 31 October. Move your MCP servers to TwinMCP in a few minutes.",
      lead: "Most MCPs hosted on Smithery are open-source packages, so the code itself does not change. What moves is the hosting, the secrets and one block of client config. TwinMCP runs each server in its own isolated sandbox and gives it one URL that serves all its MCPs, reached with an API key from your account.",
      primary: "Start free",
      secondary: "Try Pro free for a month",
      facts: [
        "Free plan",
        `${free.servers} server`,
        "No credit card",
        `Pro: first ${PRO_TRIAL_DAYS} days free`,
      ],
    },
    shutdown: {
      eyebrow: "31 October 2026",
      title: "What changes on 31 October",
      description:
        "Smithery has announced that its connection services stop on 31 October 2026 and that its public registry stays online. Its announcement is the source of truth: read it before you plan, and copy any config values you still need before then.",
      rows: smitheryShutdownRows("en"),
      source: "Read Smithery's announcement",
    },
    mapping: {
      eyebrow: "Three steps",
      title: "From Smithery to TwinMCP, line by line",
      description:
        "The MCP server is portable; the lock-in is in the deployment config. Each row is one thing to move.",
      head: ["Step", "On Smithery", "On TwinMCP"],
      rows: [
        {
          from: "The hosted URL your client connects to",
          to: (
            <>
              A TwinMCP server with the same MCPs installed from the catalogue, reached through one
              URL, <code className="font-mono text-sm">{exampleUrl("en", true)}</code>, that serves
              every MCP on it (recommended; each MCP also keeps its own URL). Authenticate with an
              API key from your account, starting with{" "}
              <code className="font-mono text-sm">ctx7sk_</code>: ideally an MCP-proxy key bound to
              that server.
            </>
          ),
        },
        {
          from: "Secrets in your Smithery config (API tokens, connection strings)",
          to: "The same values, pasted into each MCP's config form when you install it. Secret fields are stored encrypted at rest (AES-256-GCM) in that MCP's config. A value several MCPs need can live once in your account vault and be referenced as {{secret:NAME}}.",
        },
        {
          from: "The Smithery entry in Cursor, Claude Code, Windsurf or VS Code",
          to: "Replace it with the block from your server's Connect panel in the dashboard. The shapes are below; the dashboard fills in your real URL and key.",
        },
      ],
      snippetsTitle: "Client config, by client",
      snippetsNote: (
        <>
          Placeholders: replace <code className="font-mono">{EXAMPLE.en.server}</code> and{" "}
          <code className="font-mono">{API_KEY_PLACEHOLDER}</code> with your server and your API
          key. To connect a single MCP instead, add its slug to the end of the URL, for example{" "}
          <code className="font-mono">/{EXAMPLE.en.mcp}</code>. Claude Desktop, Cline and Zed have
          their own blocks in the dashboard.
        </>
      ),
    },
    compare: {
      eyebrow: "Honest differences",
      title: "What you keep, what differs",
      keepTitle: "What you keep",
      differTitle: "What differs",
      keep: [
        "The MCP code: catalogue MCPs run the same upstream open-source packages.",
        "A remote URL your client already understands (Streamable HTTP, with an mcp-remote bridge for stdio-only clients).",
        "Secrets off your laptop: stored server-side, encrypted at rest.",
        "One dashboard for seven clients: Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline and Zed.",
      ],
      differ: [
        `A smaller catalogue: ${CATALOGUE_COUNT} MCPs, not an open registry. Browse it on the public catalogue page before you move anything.`,
        "Your own MCP, or one outside the catalogue: publish it on Pro from an npm or PyPI package. It stays private to your account. Servers that only ship as a Docker image cannot run in the sandbox.",
        "No uptime SLA.",
        "Idle servers sleep: the first request after a pause takes a few seconds longer.",
        "On the server URL, tool names are prefixed with the MCP's slug (<mcp>__<tool>). A server with many tools can add ?mode=router to list three meta-tools instead.",
      ],
    },
    offer: {
      eyebrow: "The offer",
      title: "Try it free, then take the first month of Pro on us",
      description:
        "No migration fee and no contract. Start on Free to check your MCPs work, move to Pro when you need more than one server.",
      free: {
        name: "Free",
        price: formatPrice(freePlan, "monthly", "en"),
        cadence: "forever",
        bullets: [
          `${free.servers} small server`,
          `${FREE_DAILY} tool calls a day`,
          `${free.apiKeys} API keys`,
          "No credit card",
        ],
        cta: "Start free",
      },
      pro: {
        name: "Pro",
        seal: "First month free",
        price: formatPrice(proPlan, "monthly", "en"),
        cadence: `a month, or €${PRO_YEARLY_EUR} a year`,
        bullets: [
          `${pro.servers} servers, all box sizes`,
          `${PRO_DAILY.toLocaleString("en-US")} tool calls a day`,
          `${pro.apiKeys} API keys`,
          "Publish your own MCPs",
          `Audit logs · ${pro.auditRetentionDays} days`,
        ],
        trial: `First subscription: ${PRO_TRIAL_DAYS} days free. Card required, nothing charged for ${PRO_TRIAL_DAYS} days, cancel anytime.`,
        cta: "Try Pro free for a month",
      },
    },
    faq: {
      eyebrow: "Migration FAQ",
      title: "Questions before you move",
      description: "Something missing? Write to hello@twinmcp.fr.",
    },
    final: {
      title: "Move before the URLs stop answering.",
      lead: "One server is enough to check that your MCPs and your client work on TwinMCP.",
      secondary: "Read the Smithery alternatives guide",
      secondaryHref: "/blog/smithery-alternatives",
    },
    included: "Included",
    notIncluded: "Not included",
  },
  fr: {
    hero: {
      eyebrow: "Migration depuis Smithery",
      title:
        "Smithery ferme le 31 octobre. Déplacez vos serveurs MCP vers TwinMCP en quelques minutes.",
      lead: "La plupart des MCP hébergés sur Smithery sont des paquets open source : leur code ne change pas. Ce que vous déplacez, c’est l’hébergement, les secrets et un bloc de configuration client. TwinMCP fait tourner chaque serveur dans son propre sandbox isolé et lui donne une seule URL qui sert tous ses MCP, appelée avec une clé API de votre compte.",
      primary: "Commencer gratuitement",
      secondary: "Essayer Pro 1 mois gratuit",
      facts: [
        "Offre Free",
        `${free.servers} serveur`,
        "Sans carte bancaire",
        `Pro : ${PRO_TRIAL_DAYS} premiers jours offerts`,
      ],
    },
    shutdown: {
      eyebrow: "31 octobre 2026",
      title: "Ce qui change le 31 octobre",
      description:
        "Smithery a annoncé l’arrêt de ses services de connexion le 31 octobre 2026 ; son registre public reste en ligne. Son annonce fait foi : lisez-la avant de planifier, et copiez d’ici là les valeurs de configuration dont vous avez encore besoin.",
      rows: smitheryShutdownRows("fr"),
      source: "Lire l’annonce de Smithery",
    },
    mapping: {
      eyebrow: "Trois étapes",
      title: "De Smithery à TwinMCP, ligne par ligne",
      description:
        "Le serveur MCP est portable ; la dépendance tient à la configuration de déploiement. Chaque ligne est un élément à déplacer.",
      head: ["Étape", "Sur Smithery", "Sur TwinMCP"],
      rows: [
        {
          from: "L’URL hébergée à laquelle votre client se connecte",
          to: (
            <>
              Un serveur TwinMCP avec les mêmes MCP installés depuis le catalogue, joignable par une
              seule URL, <code className="font-mono text-sm">{exampleUrl("fr", true)}</code>, qui
              sert tous ses MCP (recommandé ; chaque MCP garde aussi sa propre URL).
              Authentifiez-vous avec une clé API de votre compte, qui commence par{" "}
              <code className="font-mono text-sm">ctx7sk_</code> : idéalement une clé limitée au
              proxy MCP et liée à ce serveur.
            </>
          ),
        },
        {
          from: "Les secrets de votre configuration Smithery (tokens d’API, chaînes de connexion)",
          to: "Les mêmes valeurs, collées dans le formulaire de configuration de chaque MCP à l’installation. Les champs secrets sont chiffrés au repos (AES-256-GCM) dans la configuration de ce MCP. Une valeur dont plusieurs MCP ont besoin peut être rangée une seule fois dans le coffre de votre compte et référencée par {{secret:NOM}}.",
        },
        {
          from: "L’entrée Smithery dans Cursor, Claude Code, Windsurf ou VS Code",
          to: "Remplacez-la par le bloc du panneau Connect de votre serveur, dans le tableau de bord. Les formats sont ci-dessous ; le tableau de bord y met votre vraie URL et votre clé.",
        },
      ],
      snippetsTitle: "La configuration, client par client",
      snippetsNote: (
        <>
          Valeurs d’exemple : remplacez <code className="font-mono">{EXAMPLE.fr.server}</code> et{" "}
          <code className="font-mono">{API_KEY_PLACEHOLDER}</code> par votre serveur et votre clé
          API. Pour connecter un seul MCP, ajoutez son slug à la fin de l’URL, par exemple{" "}
          <code className="font-mono">/{EXAMPLE.fr.mcp}</code>. Claude Desktop, Cline et Zed ont
          leur propre bloc dans le tableau de bord.
        </>
      ),
    },
    compare: {
      eyebrow: "Différences, sans détour",
      title: "Ce que vous gardez, ce qui change",
      keepTitle: "Ce que vous gardez",
      differTitle: "Ce qui change",
      keep: [
        "Le code des MCP : les MCP du catalogue font tourner les mêmes paquets open source d’origine.",
        "Une URL distante que votre client comprend déjà (Streamable HTTP, avec le pont mcp-remote pour les clients stdio uniquement).",
        "Des secrets hors de votre poste : stockés côté serveur, chiffrés au repos.",
        "Un tableau de bord pour sept clients : Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline et Zed.",
      ],
      differ: [
        `Un catalogue plus restreint : ${CATALOGUE_COUNT} MCP, pas un registre ouvert. Parcourez-le sur la page publique du catalogue avant de déplacer quoi que ce soit.`,
        "Votre propre MCP, ou un MCP hors catalogue : publiez-le sur Pro à partir d’un paquet npm ou PyPI. Il reste privé à votre compte. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner dans le sandbox.",
        "Pas de SLA de disponibilité.",
        "Les serveurs inactifs se mettent en veille : la première requête après une pause prend quelques secondes de plus.",
        "Sur l’URL du serveur, les noms d’outils sont préfixés par le slug du MCP (<mcp>__<tool>). Un serveur avec beaucoup d’outils peut ajouter ?mode=router pour n’exposer que trois méta-outils.",
      ],
    },
    offer: {
      eyebrow: "L’offre",
      title: "Essayez gratuitement, puis profitez du premier mois de Pro offert",
      description:
        "Ni frais de migration ni engagement. Commencez sur Free pour vérifier que vos MCP fonctionnent, passez à Pro quand un serveur ne suffit plus.",
      free: {
        name: "Free",
        price: formatPrice(freePlan, "monthly", "fr"),
        cadence: "pour toujours",
        bullets: [
          `${free.servers} petit serveur (small)`,
          `${FREE_DAILY} appels d’outils par jour`,
          `${free.apiKeys} clés API`,
          "Sans carte bancaire",
        ],
        cta: "Commencer gratuitement",
      },
      pro: {
        name: "Pro",
        seal: "Premier mois offert",
        price: formatPrice(proPlan, "monthly", "fr"),
        cadence: `par mois, ou ${PRO_YEARLY_EUR} € par an`,
        bullets: [
          `${pro.servers} serveurs, toutes les tailles de box`,
          `${PRO_DAILY.toLocaleString("fr-FR")} appels d’outils par jour`,
          `${pro.apiKeys} clés API`,
          "Publiez vos propres MCP",
          `Journaux d’audit · ${pro.auditRetentionDays} jours`,
        ],
        trial: `Premier abonnement : ${PRO_TRIAL_DAYS} jours offerts. Carte demandée, rien n’est prélevé pendant ${PRO_TRIAL_DAYS} jours, résiliable à tout moment.`,
        cta: "Essayer Pro 1 mois gratuit",
      },
    },
    faq: {
      eyebrow: "FAQ migration",
      title: "Les questions avant de migrer",
      description: "Une question manque ? Écrivez à hello@twinmcp.fr.",
    },
    final: {
      title: "Migrez avant que les URL ne répondent plus.",
      lead: "Un serveur suffit pour vérifier que vos MCP et votre client fonctionnent sur TwinMCP.",
      secondary: "Lire le guide des alternatives à Smithery",
      secondaryHref: "/fr/blog/smithery-alternatives",
    },
    included: "Inclus",
    notIncluded: "Non inclus",
  },
} as const;

// Plain-text FAQ, shared by the rendered list and the FAQPage JSON-LD.
export const SMITHERY_MIGRATION_FAQ: Record<Locale, { q: string; a: string }[]> = {
  en: [
    {
      q: "When exactly does Smithery shut down?",
      a: `On 31 October 2026. ${smitheryShutdownScope("en")} Its public registry stays online as a directory. The announcement at ${SMITHERY_FUTURE_URL} is the reference for any later change.`,
    },
    {
      q: "Do I have to change my MCP server's code?",
      a: "No. An MCP server's code is portable; the lock-in is in the deployment config. Install the same MCP on a TwinMCP server, copy your secrets into its config form, and replace the entry in your AI client with the block the dashboard generates.",
    },
    {
      q: "What if my MCP is not in the TwinMCP catalogue?",
      a: `The catalogue holds ${CATALOGUE_COUNT} MCPs. If yours is not there and it is published as an npm or PyPI package, you can publish it as your own MCP on Pro; it stays private to your account. Servers that only ship as a Docker image cannot run in the sandbox today.`,
    },
    {
      q: "How much does it cost?",
      a: `Free costs nothing: ${free.servers} small server, ${FREE_DAILY} tool calls a day, no credit card. Pro is €14.99 a month or €${PRO_YEARLY_EUR} a year for ${pro.servers} servers, every box size and ${PRO_DAILY.toLocaleString("en-US")} tool calls a day. Your first Pro subscription starts with ${PRO_TRIAL_DAYS} days free: the card is required, nothing is charged during the trial, and you can cancel anytime.`,
    },
    {
      q: "Are my secrets safe on TwinMCP?",
      a: "Each server runs in its own isolated sandbox (an Upstash Box micro-VM). Secrets such as API tokens and connection strings are stored encrypted at rest (AES-256-GCM) in each MCP's config, or once in your account vault when several MCPs share them. Every call to your MCPs is authenticated with an API key from your account, which you can limit to the MCP proxy and to one server. TwinMCP does not offer an uptime SLA.",
    },
  ],
  fr: [
    {
      q: "Quand Smithery ferme-t-il exactement ?",
      a: `Le 31 octobre 2026. ${smitheryShutdownScope("fr")} Son registre public reste en ligne comme annuaire. L’annonce sur ${SMITHERY_FUTURE_URL} fait référence pour tout changement ultérieur.`,
    },
    {
      q: "Dois-je modifier le code de mon serveur MCP ?",
      a: "Non. Le code d’un serveur MCP est portable ; la dépendance tient à la configuration de déploiement. Installez le même MCP sur un serveur TwinMCP, copiez vos secrets dans son formulaire de configuration, puis remplacez l’entrée de votre client IA par le bloc généré par le tableau de bord.",
    },
    {
      q: "Et si mon MCP n’est pas dans le catalogue TwinMCP ?",
      a: `Le catalogue compte ${CATALOGUE_COUNT} MCP. Si le vôtre n’y est pas et qu’il est publié en paquet npm ou PyPI, vous pouvez le publier comme votre propre MCP sur Pro ; il reste privé à votre compte. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner dans le sandbox aujourd’hui.`,
    },
    {
      q: "Combien ça coûte ?",
      a: `Free ne coûte rien : ${free.servers} petit serveur, ${FREE_DAILY} appels d’outils par jour, sans carte bancaire. Pro coûte 14,99 € par mois ou ${PRO_YEARLY_EUR} € par an pour ${pro.servers} serveurs, toutes les tailles de box et ${PRO_DAILY.toLocaleString("fr-FR")} appels d’outils par jour. Votre premier abonnement Pro commence par ${PRO_TRIAL_DAYS} jours offerts : la carte est demandée, rien n’est prélevé pendant l’essai et vous pouvez résilier à tout moment.`,
    },
    {
      q: "Mes secrets sont-ils protégés sur TwinMCP ?",
      a: "Chaque serveur tourne dans son propre sandbox isolé (une micro-VM Upstash Box). Les secrets, comme les tokens d’API et les chaînes de connexion, sont chiffrés au repos (AES-256-GCM) dans la configuration de chaque MCP, ou une seule fois dans le coffre de votre compte quand plusieurs MCP les partagent. Chaque appel à vos MCP est authentifié par une clé API de votre compte, que vous pouvez limiter au proxy MCP et à un seul serveur. TwinMCP ne propose pas de SLA de disponibilité.",
    },
  ],
};

// ─── Sections ────────────────────────────────────────────────────────────────

// Section eyebrow between two short hairlines (DESIGN.md §4.7), for the hero.
const eyebrowRules =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']";

const LINK =
  "text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand";

interface LocaleProps {
  locale?: Locale;
}

/** The centred name (DESIGN.md §4.2): eyebrow, engraved H1, hairline, lead, CTAs, address line. */
export function MigrationHero({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].hero;
  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <p className={eyebrowRules}>{t.eyebrow}</p>
        <h1 className="display letterpress mx-auto mt-6 max-w-4xl text-balance text-4xl md:text-5xl lg:text-6xl">
          {t.title}
        </h1>
        <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
        <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">{t.lead}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={signUpHref(locale, "free")} data-cta-location="smithery_migration_hero">
              {t.primary}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={signUpHref(locale, "pro")} data-cta-location="smithery_migration_hero_pro">
              {t.secondary}
            </Link>
          </Button>
        </div>
        <p className="smallcaps tracking-sc mt-10 text-xs text-muted-foreground">
          {t.facts.join(" · ")}
        </p>
      </div>
    </section>
  );
}

/** (a) What stops on 31 October — facts only, with the source link. */
export function ShutdownFacts({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].shutdown;
  return (
    <Section bordered eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <dl className="mx-auto max-w-3xl border-y border-foreground/50">
        {t.rows.map((row) => (
          <div
            key={row.name}
            className="grid gap-1 border-b border-border py-4 last:border-b-0 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-8"
          >
            <dt className="smallcaps tracking-sc text-base font-medium text-foreground">
              {row.name}
            </dt>
            <dd className="text-base text-muted-foreground">{row.body}</dd>
          </div>
        ))}
      </dl>
      <p className="mx-auto mt-8 max-w-3xl text-center text-sm">
        <a
          href={SMITHERY_FUTURE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${LINK} inline-flex items-center gap-1.5`}
        >
          {t.source} <span className="font-mono">smithery.ai/future</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </p>
    </Section>
  );
}

/** (b) The three-step mapping as a ledger, then the client snippets. */
export function MigrationMapping({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].mapping;
  const e = EXAMPLE[locale];
  const url = exampleUrl(locale);
  return (
    <Section bordered id="steps" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="mx-auto max-w-4xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 py-4">{t.head[0]}</TableHead>
              <TableHead className="py-4">{t.head[1]}</TableHead>
              <TableHead className="py-4">{t.head[2]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.rows.map((row, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell className="align-top">
                  <span
                    aria-hidden
                    className="lining grid h-9 w-9 place-items-center border border-foreground/60 text-base font-medium"
                  >
                    {i + 1}
                  </span>
                  <span className="sr-only">{i + 1}</span>
                </TableCell>
                <TableCell className="align-top text-base text-muted-foreground">
                  {row.from}
                </TableCell>
                <TableCell className="align-top text-base text-foreground">{row.to}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mx-auto mt-16 max-w-5xl">
        <h3 className="smallcaps tracking-sc border-b border-foreground/50 pb-3 text-lg font-medium">
          {t.snippetsTitle}
        </h3>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {SNIPPET_CLIENTS.map((ide) => {
            const cfg = buildClientConfig(ide, {
              url,
              apiKey: API_KEY_PLACEHOLDER,
              label: serverConfigLabel(e.server),
            });
            return (
              <div key={ide} className="min-w-0">
                <p className="smallcaps tracking-sc mb-2 text-sm font-medium text-foreground">
                  {CLIENT_NAMES[ide]}
                </p>
                <CodeSnippet
                  code={cfg.code}
                  language={cfg.language}
                  filename={cfg.filename}
                  locale={locale}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-sm italic text-muted-foreground">{t.snippetsNote}</p>
      </div>
    </Section>
  );
}

/** (c) What you keep / what differs — the honest column. */
export function KeepAndDiffer({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].compare;
  const c = COPY[locale];
  return (
    <Section bordered eyebrow={t.eyebrow} title={t.title}>
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <div className="border border-border bg-card p-6">
          <h3 className="smallcaps tracking-sc border-b border-border pb-3 text-lg font-medium">
            {t.keepTitle}
          </h3>
          <ul className="mt-4 space-y-3">
            {t.keep.map((item) => (
              <li key={item} className="flex gap-3 text-base text-muted-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="sr-only">{c.included}: </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-border bg-card p-6">
          <h3 className="smallcaps tracking-sc border-b border-border pb-3 text-lg font-medium">
            {t.differTitle}
          </h3>
          <ul className="mt-4 space-y-3">
            {t.differ.map((item) => (
              <li key={item} className="flex gap-3 text-base text-muted-foreground">
                <Minus className="mt-1 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/** (d) The offer: Free to try, first month of Pro free. The one gilt seal of the page. */
export function MigrationOffer({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].offer;
  return (
    <Section bordered id="offer" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="flex flex-col border border-border bg-card p-6">
          <h3 className="smallcaps tracking-sc text-lg font-medium">{t.free.name}</h3>
          <p className="mt-3">
            <span className="lining text-4xl font-medium">{t.free.price}</span>{" "}
            <span className="text-sm italic text-muted-foreground">{t.free.cadence}</span>
          </p>
          <ul className="mt-6 flex-1 space-y-2">
            {t.free.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-base text-muted-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="lining">{b}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-8">
            <Link href={signUpHref(locale, "free")} data-cta-location="smithery_migration_offer">
              {t.free.cta}
            </Link>
          </Button>
        </div>

        <div className="relative flex flex-col border border-foreground/70 bg-card p-6 shadow-stack">
          <Badge variant="gilt" className="absolute -top-3 left-6">
            {t.pro.seal}
          </Badge>
          <h3 className="smallcaps tracking-sc text-lg font-medium">{t.pro.name}</h3>
          <p className="mt-3">
            <span className="lining text-4xl font-medium">{t.pro.price}</span>{" "}
            <span className="lining text-sm italic text-muted-foreground">{t.pro.cadence}</span>
          </p>
          <ul className="mt-6 flex-1 space-y-2">
            {t.pro.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-base text-muted-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="lining">{b}</span>
              </li>
            ))}
          </ul>
          <p className="lining mt-6 border-t border-border pt-4 text-sm italic text-muted-foreground">
            {t.pro.trial}
          </p>
          <Button asChild className="mt-6">
            <Link href={signUpHref(locale, "pro")} data-cta-location="smithery_migration_offer_pro">
              {t.pro.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

/** (e) FAQ — printed open (variant "list") so the answers match the JSON-LD. */
export function MigrationFaq({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].faq;
  return (
    <div className="rule-double">
      <Faq
        locale={locale}
        items={SMITHERY_MIGRATION_FAQ[locale]}
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        id="migration-faq"
        variant="list"
      />
    </div>
  );
}

/** Closing card: title, short rule, lead, the two CTAs. */
export function MigrationFinalCta({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].final;
  const hero = COPY[locale].hero;
  return (
    <Section bordered>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 border border-border bg-card px-6 py-12 text-center shadow-sm md:px-12 md:py-14">
        <h2 className="text-balance text-3xl font-medium md:text-4xl">{t.title}</h2>
        <div className="h-px w-12 bg-foreground/40" />
        <p className="max-w-xl text-balance text-lg text-muted-foreground">{t.lead}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={signUpHref(locale, "free")} data-cta-location="smithery_migration_final">
              {hero.primary}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={signUpHref(locale, "pro")} data-cta-location="smithery_migration_final_pro">
              {hero.secondary}
            </Link>
          </Button>
        </div>
        <Link href={t.secondaryHref as Route} className={`${LINK} text-sm`}>
          {t.secondary}
        </Link>
      </div>
    </Section>
  );
}

/** The whole landing, in order: hero, (a) shutdown, (b) mapping, (c) differences, (d) offer, (e) FAQ. */
export function SmitheryMigration({ locale = "en" }: LocaleProps) {
  return (
    <>
      <MigrationHero locale={locale} />
      <ShutdownFacts locale={locale} />
      <MigrationMapping locale={locale} />
      <KeepAndDiffer locale={locale} />
      <MigrationOffer locale={locale} />
      <MigrationFaq locale={locale} />
      <MigrationFinalCta locale={locale} />
    </>
  );
}
