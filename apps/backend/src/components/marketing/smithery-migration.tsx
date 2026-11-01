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
import { walletFacts } from "@/components/pricing/wallet-copy";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import {
  API_KEY_PLACEHOLDER,
  buildClientConfig,
  buildServerUrl,
  serverConfigLabel,
  type IdeKey,
} from "@/lib/mcp/client-config";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
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
// and components/pricing/wallet-copy.ts (prices from lib/wallet/pricing.ts). No SLA, no region choice, no team
// sharing, no always-on promise.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
export const SMITHERY_FUTURE_URL = "https://smithery.ai/future";

export const MIGRATION_PATHS = {
  en: "/migrate-from-smithery",
  fr: "/fr/migrer-depuis-smithery",
} as const satisfies Record<Locale, string>;

const SIGN_UP = { en: "/sign-up", fr: "/fr/inscription" } as const satisfies Record<Locale, string>;

const PRICING_PATH = { en: "/plans", fr: "/fr/tarifs" } as const satisfies Record<Locale, string>;

function signUpHref(locale: Locale): Route {
  return SIGN_UP[locale] as Route;
}

function pricingHref(locale: Locale): Route {
  return PRICING_PATH[locale] as Route;
}

// Plan facts, derived from the single sources of truth so the copy cannot drift.
const free = PLAN_CAPABILITIES.free;
const pro = PLAN_CAPABILITIES.pro;
const EN = walletFacts("en");
const FR = walletFacts("fr");

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
      primary: `Start with ${EN.signupCredit} free`,
      secondary: "See pricing",
      facts: [
        `${EN.signupCredit} of free credit`,
        `${free.servers} server`,
        "No credit card",
        "No subscription",
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
        "Your own MCP, or one outside the catalogue: publish it from an npm or PyPI package once your account is funded. It stays private to your account. Servers that only ship as a Docker image cannot run in the sandbox.",
        "No uptime SLA.",
        "Idle servers sleep: the first request after a pause takes a few seconds longer.",
        "On the server URL, tool names are prefixed with the MCP's slug (<mcp>__<tool>). A server with many tools can add ?mode=router to list three meta-tools instead.",
      ],
    },
    offer: {
      eyebrow: "The offer",
      title: `Try it on ${EN.signupCredit} of free credit, then pay as you go`,
      description:
        "No migration fee, no contract and no subscription. Use the free credit to check your MCPs work, then top up when you need more than one server.",
      free: {
        name: "Free credit",
        price: EN.signupCredit,
        cadence: `on sign-up, valid ${EN.signupDays} days`,
        bullets: [
          `${free.servers} small server`,
          `About ${EN.creditCalls} tool calls’ worth, before compute`,
          `${free.apiKeys} API keys`,
          "No credit card",
        ],
        cta: `Get ${EN.signupCredit} of free credit`,
      },
      pro: {
        name: "Pay as you go",
        seal: "No subscription",
        price: EN.minTopup,
        cadence: "minimum top-up",
        bullets: [
          `${pro.servers} servers, all box sizes`,
          `Tool calls ${EN.per1000Calls} per 1,000`,
          `Compute from ${EN.cpuHour.small} per active CPU-hour`,
          `${pro.apiKeys} API keys`,
          "Publish your own MCPs",
          `Audit logs · ${pro.auditRetentionDays} days`,
        ],
        trial:
          "Prepaid: at zero, calls stop and nothing is charged to a card unless you turn on auto-recharge.",
        cta: "See the price list",
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
      primary: `Démarrer avec ${FR.signupCredit} offerts`,
      secondary: "Voir les tarifs",
      facts: [
        `${FR.signupCredit} de crédit offert`,
        `${free.servers} serveur`,
        "Sans carte bancaire",
        "Sans abonnement",
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
        "Votre propre MCP, ou un MCP hors catalogue : publiez-le à partir d’un paquet npm ou PyPI une fois votre compte alimenté. Il reste privé à votre compte. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner dans le sandbox.",
        "Pas de SLA de disponibilité.",
        "Les serveurs inactifs se mettent en veille : la première requête après une pause prend quelques secondes de plus.",
        "Sur l’URL du serveur, les noms d’outils sont préfixés par le slug du MCP (<mcp>__<tool>). Un serveur avec beaucoup d’outils peut ajouter ?mode=router pour n’exposer que trois méta-outils.",
      ],
    },
    offer: {
      eyebrow: "L’offre",
      title: `Essayez avec ${FR.signupCredit} de crédit offert, puis payez à l’usage`,
      description:
        "Ni frais de migration, ni engagement, ni abonnement. Utilisez le crédit offert pour vérifier que vos MCP fonctionnent, puis rechargez quand un serveur ne suffit plus.",
      free: {
        name: "Crédit offert",
        price: FR.signupCredit,
        cadence: `à l’inscription, valable ${FR.signupDays} jours`,
        bullets: [
          `${free.servers} petit serveur (small)`,
          `L’équivalent d’environ ${FR.creditCalls} appels d’outils, hors calcul`,
          `${free.apiKeys} clés API`,
          "Sans carte bancaire",
        ],
        cta: `Recevoir ${FR.signupCredit} de crédit offert`,
      },
      pro: {
        name: "Paiement à l’usage",
        seal: "Sans abonnement",
        price: FR.minTopup,
        cadence: "recharge minimale",
        bullets: [
          `${pro.servers} serveurs, toutes les tailles de box`,
          `Appels d’outils ${FR.per1000Calls} les 1 000`,
          `Calcul dès ${FR.cpuHour.small} par heure de CPU actif`,
          `${pro.apiKeys} clés API`,
          "Publiez vos propres MCP",
          `Journaux d’audit · ${pro.auditRetentionDays} jours`,
        ],
        trial:
          "Prépayé : à zéro, les appels s’arrêtent et rien n’est prélevé sur une carte, sauf si vous activez la recharge automatique.",
        cta: "Voir la grille tarifaire",
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
      a: `The catalogue holds ${CATALOGUE_COUNT} MCPs. If yours is not there and it is published as an npm or PyPI package, you can publish it as your own MCP once your account is funded (after your first top-up); it stays private to your account. Servers that only ship as a Docker image cannot run in the sandbox today.`,
    },
    {
      q: "How much does it cost?",
      a: `There is no subscription. Every new account gets ${EN.signupCredit} of free credit, valid ${EN.signupDays} days, no card: ${free.servers} small server to test your migration. After that you top up a prepaid balance from ${EN.minTopup}, which unlocks ${pro.servers} servers and every box size. Tool calls cost ${EN.per1000Calls} per 1,000 and compute ${EN.cpuHour.small} per active CPU-hour on a small server. At zero, calls stop: no surprise bills.`,
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
      a: `Le catalogue compte ${CATALOGUE_COUNT} MCP. Si le vôtre n’y est pas et qu’il est publié en paquet npm ou PyPI, vous pouvez le publier comme votre propre MCP une fois votre compte alimenté (après votre première recharge) ; il reste privé à votre compte. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner dans le sandbox aujourd’hui.`,
    },
    {
      q: "Combien ça coûte ?",
      a: `Il n’y a pas d’abonnement. Chaque nouveau compte reçoit ${FR.signupCredit} de crédit offert, valable ${FR.signupDays} jours, sans carte : ${free.servers} petit serveur pour tester votre migration. Ensuite, vous rechargez un solde prépayé à partir de ${FR.minTopup}, ce qui débloque ${pro.servers} serveurs et toutes les tailles de box. Les appels d’outils coûtent ${FR.per1000Calls} les 1 000 et le calcul ${FR.cpuHour.small} par heure de CPU actif sur un petit serveur. À zéro, les appels s’arrêtent : aucune facture surprise.`,
    },
    {
      q: "Mes secrets sont-ils protégés sur TwinMCP ?",
      a: "Chaque serveur tourne dans son propre sandbox isolé (une micro-VM Upstash Box). Les secrets, comme les tokens d’API et les chaînes de connexion, sont chiffrés au repos (AES-256-GCM) dans la configuration de chaque MCP, ou une seule fois dans le coffre de votre compte quand plusieurs MCP les partagent. Chaque appel à vos MCP est authentifié par une clé API de votre compte, que vous pouvez limiter au proxy MCP et à un seul serveur. TwinMCP ne propose pas de SLA de disponibilité.",
    },
  ],
};

// ─── Sections ────────────────────────────────────────────────────────────────

const LINK = "font-medium text-brand underline underline-offset-4 hover:decoration-2";

interface LocaleProps {
  locale?: Locale;
}

/** Hero: eyebrow, H1, lead, one rose CTA (the credit), pricing, the facts line. */
export function MigrationHero({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].hero;
  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-4xl text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {t.title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">{t.lead}</p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <Link href={signUpHref(locale)} data-cta-location="smithery_migration_hero">
              {t.primary}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={pricingHref(locale)} data-cta-location="smithery_migration_hero_pricing">
              {t.secondary}
            </Link>
          </Button>
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {t.facts.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-success" aria-hidden />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** (a) What stops on 31 October — facts only, with the source link. */
export function ShutdownFacts({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].shutdown;
  return (
    <Section bordered eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <dl className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
        {t.rows.map((row) => (
          <div
            key={row.name}
            className="grid gap-1 px-5 py-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-8 sm:px-6"
          >
            <dt className="text-base font-semibold text-foreground">{row.name}</dt>
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
      <div className="mx-auto max-w-4xl">
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
                    className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold tabular-nums text-brand-foreground"
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
        <h3 className="font-display text-xl font-semibold tracking-tight">{t.snippetsTitle}</h3>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {SNIPPET_CLIENTS.map((ide) => {
            const cfg = buildClientConfig(ide, {
              url,
              apiKey: API_KEY_PLACEHOLDER,
              label: serverConfigLabel(e.server),
            });
            return (
              <div key={ide} className="min-w-0">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  {hasBrandLogo(ide) ? <BrandLogo slug={ide} size={18} decorative /> : null}
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
        <p className="mt-6 text-sm text-muted-foreground">{t.snippetsNote}</p>
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
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 md:gap-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">{t.keepTitle}</h3>
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
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">{t.differTitle}</h3>
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

/** (d) The offer: free credit to try (the highlighted card, the rose action), then pay as you go. */
export function MigrationOffer({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].offer;
  return (
    <Section bordered id="offer" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2 md:gap-6">
        <div className="flex flex-col rounded-2xl border border-offer-border bg-offer p-5 shadow-sm sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">{t.free.name}</h3>
          <p className="mt-3">
            <span className="font-display text-4xl font-extrabold tabular-nums text-primary">
              {t.free.price}
            </span>{" "}
            <span className="text-sm text-muted-foreground">{t.free.cadence}</span>
          </p>
          <ul className="mt-6 flex-1 space-y-2">
            {t.free.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-base text-muted-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="tabular-nums">{b}</span>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-8">
            <Link href={signUpHref(locale)} data-cta-location="smithery_migration_offer">
              {t.free.cta}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="relative flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <Badge variant="brand" className="absolute -top-3 left-6 bg-card">
            {t.pro.seal}
          </Badge>
          <h3 className="font-display text-lg font-semibold tracking-tight">{t.pro.name}</h3>
          <p className="mt-3">
            <span className="font-display text-4xl font-extrabold tabular-nums">{t.pro.price}</span>{" "}
            <span className="tabular-nums text-sm text-muted-foreground">{t.pro.cadence}</span>
          </p>
          <ul className="mt-6 flex-1 space-y-2">
            {t.pro.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-base text-muted-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="tabular-nums">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-border pt-4 text-sm tabular-nums text-muted-foreground">
            {t.pro.trial}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href={pricingHref(locale)} data-cta-location="smithery_migration_offer_pricing">
              {t.pro.cta}
              <ArrowRight aria-hidden />
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
    <div className="border-t border-border">
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

/** Closing panel on the surface band: title, lead, the two CTAs, the guided-setup link. */
export function MigrationFinalCta({ locale = "en" }: LocaleProps) {
  const t = COPY[locale].final;
  const hero = COPY[locale].hero;
  return (
    <Section bordered>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl bg-surface-band px-6 py-12 text-center md:px-14 md:py-14">
        <h2 className="text-balance font-display text-3xl font-bold tracking-tight md:text-4xl">
          {t.title}
        </h2>
        <p className="max-w-xl text-balance text-lg text-muted-foreground">{t.lead}</p>
        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <Link href={signUpHref(locale)} data-cta-location="smithery_migration_final">
              {hero.primary}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={pricingHref(locale)} data-cta-location="smithery_migration_final_pricing">
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
