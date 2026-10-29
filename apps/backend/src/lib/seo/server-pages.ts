// Page data for the programmatic MCP pages:
//   /servers/<slug>            "Host the <Name> MCP server"            (+ /fr/serveurs/<slug>)
//   /servers/<slug>/<client>   "Use the <Name> MCP server in <Client>" (+ FR for a few slugs)
//
// Everything is derived from the seed entry (lib/servers/catalog.ts reads
// lib/servers/seed-catalog.ts): name, description, launch command, config
// fields and their "where to get it" hints, host mode. Snippets come from the
// same buildClientConfig() as the dashboard Connect panel, and plan numbers
// from the modules that enforce them. Nothing is invented per page: the text
// varies because the real fields, runtime, host mode and client differ.
//
// Pure: no React, no I/O. Unit-tested in src/__tests__/server-pages.test.ts.

import { FR_SERVER_CLIENT_GUIDE_SLUGS, SERVERS_PATHS, type Locale } from "@/lib/i18n/locales";
import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  MATRIX_CLIENTS,
  buildClientConfig,
  buildServerUrl,
  proxyUrl,
  type IdeKey,
} from "@/lib/mcp/client-config";
import {
  SERVERS,
  categoryLabel,
  getServerBySlug,
  localizedDescription,
  localizedFieldDescription,
  type CategoryKey,
  type ServerEntry,
} from "@/lib/servers/catalog";
import { PLAN_CAPABILITIES, PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";
import { PLANS, formatEur } from "@/components/pricing/pricing-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

/**
 * How public copy names the local agent of Local (agent) servers. No command
 * here on purpose: the dashboard prints it from lib/cli.ts (localAgentCommand,
 * `npx -y @twinmcp/cli connect --server <slug>`), and the public pages should
 * not advertise it before @twinmcp/cli is on npm. Never `npx ctx7`: that is
 * Upstash's Context7 CLI, with no `connect`. Shared with
 * app/servers/_components/copy.ts; server-pages.test.ts bans "ctx7 connect".
 */
export const LOCAL_AGENT = {
  en: "the TwinMCP local agent (the exact command is in the server's Connect panel)",
  fr: "l’agent local TwinMCP (la commande exacte est dans le panneau Connect du serveur)",
} as const;

/** Search-result limits the builders respect (title includes the brand suffix). */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/** Placeholder server slug shown in the snippets, per locale (as in the docs). */
export const EXAMPLE_SERVER = { en: "my-server", fr: "mon-serveur" } as const satisfies Record<
  Locale,
  string
>;

/** Where the troubleshooting section lives (components/docs/docs-facts.ts). */
const DOCS_PATH: Record<Locale, string> = { en: "/docs", fr: "/fr/docs" };
const SIGN_UP_PATH: Record<Locale, string> = {
  en: "/sign-up?plan=free",
  fr: "/fr/inscription?plan=free",
};
const PRICING_PATH: Record<Locale, string> = { en: "/plans", fr: "/fr/tarifs" };

// ─── Small text helpers ──────────────────────────────────────────────────────

/** The first candidate that fits `max` characters; else the last one, cut on a word. */
export function fitTitle(candidates: string[], max = TITLE_MAX): string {
  const fit = candidates.find((c) => c.length <= max);
  if (fit) return fit;
  return clampText(candidates[candidates.length - 1] ?? "", max);
}

/** Cut `text` to at most `max` characters on a word boundary, ending with "…". */
export function clampText(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.—–-]+$/, "");
  return `${base}…`;
}

/** "A", "A and B", "A, B and C" (FR: "et"). */
export function joinList(items: string[], locale: Locale): string {
  const and = locale === "fr" ? "et" : "and";
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

// ─── Launch command ──────────────────────────────────────────────────────────

export interface LaunchInfo {
  /** Language of the package: npm → Node.js, PyPI (uvx) → Python. */
  runtime: "node" | "python" | "other";
  launcher: "npx" | "uvx" | null;
  /** npm or PyPI package name, or the command name for a git source. */
  packageName: string | null;
  /** Exact pinned version, or null when the launcher resolves the latest release. */
  pinnedVersion: string | null;
  /** True when uvx installs the package straight from a git repository. */
  fromGit: boolean;
  /** The command TwinMCP runs, as in the seed. */
  command: string;
}

/** What a seed `startCmd` runs: `npx -y pkg@1.2.3 …`, `uvx pkg …`, `uvx --from git+… cmd`. */
export function parseLaunch(startCmd: string): LaunchInfo {
  const command = startCmd.trim();
  const npx = command.match(/\bnpx\s+-y\s+((?:@[^\s@/]+\/)?[^\s@]+)(?:@(\S+))?/);
  if (npx) {
    const version = npx[2] && npx[2] !== "latest" ? npx[2] : null;
    return {
      runtime: "node",
      launcher: "npx",
      packageName: npx[1]!,
      pinnedVersion: version,
      fromGit: false,
      command,
    };
  }
  const uvxGit = command.match(/\buvx\s+--from\s+(\S+)\s+([A-Za-z0-9._-]+)/);
  if (uvxGit) {
    return {
      runtime: "python",
      launcher: "uvx",
      packageName: uvxGit[2]!,
      pinnedVersion: null,
      fromGit: uvxGit[1]!.startsWith("git+"),
      command,
    };
  }
  const uvx = command.match(/\buvx\s+([A-Za-z0-9._-]+)(?:==(\S+))?/);
  if (uvx) {
    return {
      runtime: "python",
      launcher: "uvx",
      packageName: uvx[1]!,
      pinnedVersion: uvx[2] ?? null,
      fromGit: false,
      command,
    };
  }
  return {
    runtime: "other",
    launcher: null,
    packageName: null,
    pinnedVersion: null,
    fromGit: false,
    command,
  };
}

/** "the npm package x@1.2.3" / "the Python package x" — for step and FAQ text. */
function packagePhrase(launch: LaunchInfo, locale: Locale): string {
  const fr = locale === "fr";
  if (!launch.packageName) return fr ? "le serveur" : "the server";
  if (launch.launcher === "npx") {
    const id = launch.pinnedVersion
      ? `${launch.packageName}@${launch.pinnedVersion}`
      : launch.packageName;
    return fr ? `le paquet npm ${id}` : `the npm package ${id}`;
  }
  if (launch.fromGit) {
    return fr
      ? `le paquet Python ${launch.packageName} (depuis son dépôt Git)`
      : `the Python package ${launch.packageName} (from its Git repository)`;
  }
  return fr ? `le paquet Python ${launch.packageName}` : `the Python package ${launch.packageName}`;
}

// ─── Config fields ───────────────────────────────────────────────────────────

export interface ConfigFieldView {
  key: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  secret: boolean;
  /** What it is and where to get it — the seed's hint, localized. */
  description: string;
}

export function configFields(entry: ServerEntry, locale: Locale): ConfigFieldView[] {
  return Object.entries(entry.seed.configSchema.properties).map(([key, f]) => ({
    key,
    type: f.type,
    required: f.required === true,
    secret: f.secret === true,
    description: localizedFieldDescription(entry, key, locale),
  }));
}

// ─── Plan facts (from the code that enforces them) ───────────────────────────

export interface PlanFacts {
  freeServers: number;
  freeDaily: string;
  proServers: number;
  proDaily: string;
  proMonthly: string;
  proAnnual: string;
  trialDays: number;
}

export function planFacts(locale: Locale): PlanFacts {
  const pro = PLANS.find((p) => p.id === "pro")!;
  const n = (v: number) => v.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
  return {
    freeServers: PLAN_CAPABILITIES.free.servers,
    freeDaily: n(getDailyLimit("free")),
    proServers: PLAN_CAPABILITIES.pro.servers,
    proDaily: n(getDailyLimit("pro")),
    proMonthly: formatEur(pro.monthlyUsd, locale),
    proAnnual: formatEur(pro.annualTotalEur, locale),
    trialDays: PRO_TRIAL_DAYS,
  };
}

// ─── Paths ───────────────────────────────────────────────────────────────────

export function serversIndexPath(locale: Locale): string {
  return SERVERS_PATHS[locale];
}

export function serverPath(slug: string, locale: Locale): string {
  return `${SERVERS_PATHS[locale]}/${slug}`;
}

export function clientPath(slug: string, client: IdeKey, locale: Locale): string {
  return `${SERVERS_PATHS[locale]}/${slug}/${client}`;
}

/** True when /fr/serveurs/<slug>/<client> exists (lib/i18n/locales.ts). */
export function hasFrClientGuides(slug: string): boolean {
  return FR_SERVER_CLIENT_GUIDE_SLUGS.includes(slug);
}

export function isClientSlug(value: string): value is IdeKey {
  return (MATRIX_CLIENTS as string[]).includes(value);
}

/**
 * MCPs whose per-client guides are indexed. Every (MCP × client) guide is
 * built and reachable, but the guides share one template, so only the most
 * searched MCPs are offered to search engines; the rest are
 * `noindex, follow` and stay out of the sitemap (the /servers/<slug> page
 * already shows every client's snippet). Pinned by server-pages.test.ts.
 */
export const INDEXED_CLIENT_GUIDE_SLUGS: readonly string[] = [
  "filesystem",
  "fetch",
  "notion",
  "slack",
  "postgres",
  "linear",
  "stripe",
  "supabase",
];

/** True when /servers/<slug>/<client> (and its FR twin) may be indexed. */
export function isClientGuideIndexed(slug: string): boolean {
  return INDEXED_CLIENT_GUIDE_SLUGS.includes(slug);
}

/** generateStaticParams for /servers/[slug] and /fr/serveurs/[slug]. */
export function serverPageParams(): Array<{ slug: string }> {
  return SERVERS.map((s) => ({ slug: s.slug }));
}

/** generateStaticParams for /servers/[slug]/[client] (or the FR subset). */
export function clientPageParams(locale: Locale): Array<{ slug: string; client: IdeKey }> {
  return SERVERS.filter((s) => locale === "en" || hasFrClientGuides(s.slug)).flatMap((s) =>
    MATRIX_CLIENTS.map((client) => ({ slug: s.slug, client }))
  );
}

/** The client guides listed in the sitemap: the indexed subset of clientPageParams. */
export function indexedClientPageParams(locale: Locale): Array<{ slug: string; client: IdeKey }> {
  return clientPageParams(locale).filter((p) => isClientGuideIndexed(p.slug));
}

// ─── Snippets ────────────────────────────────────────────────────────────────

export interface ClientSnippetView {
  client: IdeKey;
  label: string;
  /** Config file path, or the instruction when the snippet is a command. */
  filename: string;
  language: string;
  code: string;
  /** Stdio-only client: the snippet runs the mcp-remote bridge with npx. */
  bridged: boolean;
  /** The snippet is a terminal command rather than a file entry. */
  command: boolean;
}

const FR_FILENAME: Partial<Record<IdeKey, string>> = {
  "claude-code": "Claude Code — à lancer dans votre terminal",
};

/** The per-MCP URL shown in the snippets (placeholder server slug). */
export function exampleMcpUrl(slug: string, locale: Locale, origin = SITE_URL): string {
  return proxyUrl(origin, EXAMPLE_SERVER[locale], slug);
}

/** The whole-server URL (every MCP of the server behind one endpoint). */
export function exampleServerUrl(locale: Locale, origin = SITE_URL): string {
  return buildServerUrl(origin, EXAMPLE_SERVER[locale]);
}

export function clientSnippet(
  slug: string,
  client: IdeKey,
  locale: Locale,
  origin = SITE_URL
): ClientSnippetView {
  const cfg = buildClientConfig(client, {
    url: exampleMcpUrl(slug, locale, origin),
    apiKey: API_KEY_PLACEHOLDER,
    label: slug,
  });
  return {
    client,
    label: IDE_LABELS[client],
    filename: (locale === "fr" && FR_FILENAME[client]) || cfg.filename,
    language: cfg.language,
    code: cfg.code,
    bridged: cfg.code.includes("mcp-remote"),
    command: cfg.language === "bash",
  };
}

/** One snippet per named client, in Connect-panel order. */
export function clientSnippets(slug: string, locale: Locale, origin = SITE_URL) {
  return MATRIX_CLIENTS.map((c) => clientSnippet(slug, c, locale, origin));
}

/** "mcp.json" from "~/.cursor/mcp.json  (or …)"; null for a command. */
export function configFileName(snippet: ClientSnippetView): string | null {
  if (snippet.command) return null;
  return snippet.filename.match(/([\w.-]+\.json)/)?.[1] ?? null;
}

// ─── Per-MCP page ────────────────────────────────────────────────────────────

export interface StepData {
  name: string;
  text: string;
}

export interface FaqData {
  q: string;
  a: string;
}

export interface ServerPageData {
  locale: Locale;
  slug: string;
  name: string;
  description: string;
  categoryKey: CategoryKey;
  categoryLabel: string;
  hostMode: "box" | "local";
  launch: LaunchInfo;
  repoUrl: string | null;
  /** Blog posts that discuss this MCP (catalog.ts). */
  relatedBlogSlugs: string[];
  fields: ConfigFieldView[];
  requiredKeys: string[];
  optionalKeys: string[];
  /** Short facts for the header's address line. */
  facts: string[];
  h1: string;
  title: string;
  metaDescription: string;
  path: string;
  /** hreflang map (both locales always exist for a per-MCP page). */
  languages: Record<string, string>;
  steps: StepData[];
  faq: FaqData[];
  mcpUrl: string;
  serverUrl: string;
  signUpHref: string;
  pricingHref: string;
  docsHref: string;
}

function factsFor(
  entry: ServerEntry,
  launch: LaunchInfo,
  fields: ConfigFieldView[],
  locale: Locale
): string[] {
  const fr = locale === "fr";
  const out = [categoryLabel(entry.categoryKey, locale)];
  if (launch.runtime === "node") out.push(fr ? "Node.js · npm" : "Node.js · npm");
  if (launch.runtime === "python") out.push(fr ? "Python · uvx" : "Python · uvx");
  if (launch.pinnedVersion) {
    out.push(fr ? `version ${launch.pinnedVersion} épinglée` : `pinned ${launch.pinnedVersion}`);
  } else if (launch.launcher) {
    out.push(fr ? "dernière version" : "latest release");
  }
  out.push(
    entry.hostMode === "local"
      ? fr
        ? "s’exécute sur votre machine"
        : "runs on your machine"
      : fr
        ? "box isolée"
        : "isolated box"
  );
  const reqSecrets = fields.filter((f) => f.required && f.secret).length;
  const reqOther = fields.filter((f) => f.required && !f.secret).length;
  if (reqSecrets > 0) {
    out.push(
      fr
        ? `${reqSecrets} secret${reqSecrets > 1 ? "s" : ""} requis`
        : `${reqSecrets} secret${reqSecrets > 1 ? "s" : ""} required`
    );
  } else if (reqOther > 0) {
    out.push(
      fr
        ? `${reqOther} réglage${reqOther > 1 ? "s" : ""} requis`
        : `${reqOther} required setting${reqOther > 1 ? "s" : ""}`
    );
  } else {
    out.push(fr ? "sans clé API" : "no API key");
  }
  return out;
}

function stepsFor(
  entry: ServerEntry,
  launch: LaunchInfo,
  required: string[],
  optional: string[],
  locale: Locale
): StepData[] {
  const fr = locale === "fr";
  const name = entry.name;
  const local = entry.hostMode === "local";
  const pkg = packagePhrase(launch, locale);

  const create: StepData = local
    ? {
        name: fr ? "Créer un serveur local" : "Create a local server",
        text: fr
          ? `Créez un compte gratuit, puis un serveur Local (agent), et lancez ${LOCAL_AGENT.fr} sur la machine où ${name} doit tourner.`
          : `Sign up free, create a Local (agent) server, and run ${LOCAL_AGENT.en} on the machine where ${name} should run.`,
      }
    : {
        name: fr ? "Créer un serveur" : "Create a server",
        text: fr
          ? "Créez un compte gratuit et un serveur : TwinMCP lui attribue sa propre Upstash Box isolée."
          : "Sign up free and create a server: TwinMCP gives it its own isolated Upstash Box.",
      };

  let configure: string;
  if (required.length > 0) {
    configure = fr
      ? `renseignez ${joinList(required, locale)}`
      : `fill in ${joinList(required, locale)}`;
    if (optional.length > 0) {
      configure += fr
        ? ` (facultatif : ${joinList(optional, locale)})`
        : ` (optional: ${joinList(optional, locale)})`;
    }
    const many = required.length + optional.length > 1;
    configure += fr
      ? many
        ? ". Les valeurs sont stockées chiffrées et transmises au serveur comme variables d’environnement."
        : ". La valeur est stockée chiffrée et transmise au serveur comme variable d’environnement."
      : many
        ? ". The values are stored encrypted and passed to the server as environment variables."
        : ". The value is stored encrypted and passed to the server as an environment variable.";
  } else if (optional.length > 0) {
    configure = fr
      ? `rien n’est obligatoire ; ${joinList(optional, locale)} ${optional.length > 1 ? "sont facultatifs" : "est facultatif"}.`
      : `nothing is required; ${joinList(optional, locale)} ${optional.length > 1 ? "are" : "is"} optional.`;
  } else {
    configure = fr ? "il n’y a rien à renseigner." : "there is nothing to fill in.";
  }

  const install: StepData = {
    name: fr ? `Installer ${name}` : `Install ${name}`,
    text: local
      ? fr
        ? `Installez ${name} depuis la marketplace sur ce serveur : ${configure} L’agent local lance ${pkg} sur votre machine.`
        : `Install ${name} from the marketplace on that server: ${configure} The local agent runs ${pkg} on your machine.`
      : fr
        ? `Installez ${name} depuis la marketplace : ${configure} TwinMCP lance ${pkg} dans la box${launch.launcher === "uvx" ? " avec uvx" : launch.launcher === "npx" ? " avec npx" : ""}.`
        : `Install ${name} from the marketplace: ${configure} TwinMCP runs ${pkg} in the box${launch.launcher === "uvx" ? " with uvx" : launch.launcher === "npx" ? " with npx" : ""}.`,
  };

  const connect: StepData = {
    name: fr ? "Connecter votre client" : "Connect your client",
    text: fr
      ? `Ouvrez le panneau Connect du serveur, générez une clé API (ctx7sk_…) et collez le bloc de votre client : Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline ou Zed.`
      : `Open the server's Connect panel, generate an API key (ctx7sk_…) and paste your client's snippet: Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline or Zed.`,
  };

  return [create, install, connect];
}

function faqFor(
  entry: ServerEntry,
  launch: LaunchInfo,
  required: string[],
  optional: string[],
  locale: Locale
): FaqData[] {
  const fr = locale === "fr";
  const name = entry.name;
  const p = planFacts(locale);
  const out: FaqData[] = [];

  // 1. Keys — from the real config schema.
  if (required.length > 0) {
    const many = required.length + optional.length > 1;
    out.push({
      q: fr
        ? `De quelles clés le serveur MCP ${name} a-t-il besoin ?`
        : `Which keys does the ${name} MCP server need?`,
      a: fr
        ? `${joinList(required, locale)}${optional.length ? `, plus ${joinList(optional, locale)} en option` : ""} (où ${many ? "les " : "l’"}obtenir : voir le tableau ci-dessus). Vous ${many ? "les" : "la"} saisissez une fois en installant ${name} ; ${many ? "elles restent chiffrées" : "elle reste chiffrée"} sur TwinMCP et n’${many ? "apparaissent" : "apparaît"} jamais dans la configuration de votre client, qui ne contient que l’URL TwinMCP et votre clé API.`
        : `${joinList(required, locale)}${optional.length ? `, plus optional ${joinList(optional, locale)}` : ""} (where to get ${many ? "each" : "it"} is in the table above). You enter ${many ? "them" : "it"} once when you install ${name}; ${many ? "they stay" : "it stays"} encrypted on TwinMCP and never ${many ? "appear" : "appears"} in your client config, which only holds the TwinMCP URL and your API key.`,
    });
  } else {
    out.push({
      q: fr
        ? `Le serveur MCP ${name} demande-t-il une clé API ?`
        : `Does the ${name} MCP server need an API key?`,
      a: fr
        ? `Non. ${name} n’a besoin d’aucune clé API${optional.length ? ` ; ${joinList(optional, locale)} ${optional.length > 1 ? "sont des réglages facultatifs" : "est un réglage facultatif"}` : ""}. Installez-le, puis connectez votre client avec l’URL TwinMCP et votre clé API TwinMCP.`
        : `No. ${name} needs no API key${optional.length ? `; ${joinList(optional, locale)} ${optional.length > 1 ? "are optional settings" : "is an optional setting"}` : ""}. Install it, then connect your client with the TwinMCP URL and your TwinMCP API key.`,
    });
  }

  // 2. Where it runs — from hostMode and the launch command.
  if (entry.hostMode === "local") {
    out.push({
      q: fr ? `Où s’exécute ${name} ?` : `Where does ${name} run?`,
      a: fr
        ? `Sur votre propre machine. ${name} est un outil local : ${LOCAL_AGENT.fr} le lance sur un serveur Local (agent) et TwinMCP lui relaie les requêtes de votre client. Il ne répond que tant que l’agent tourne.`
        : `On your own machine. ${name} is a local tool: ${LOCAL_AGENT.en} runs it on a Local (agent) server and TwinMCP relays your client's requests to it. It only answers while the agent is running.`,
    });
  } else {
    out.push({
      q: fr ? `Où s’exécute ${name} ?` : `Where does ${name} run?`,
      a: fr
        ? `Dans l’Upstash Box isolée du serveur sur lequel vous l’installez, lancé par la commande ${launch.command}. Votre client l’atteint en Streamable HTTP via le proxy TwinMCP, authentifié par votre clé API.`
        : `In the isolated Upstash Box of the server you install it on, started with ${launch.command}. Your client reaches it over Streamable HTTP through the TwinMCP proxy, authenticated with your API key.`,
    });
  }

  // 3. Plan — from plan-features.ts, rate-limit.ts and pricing-data.ts.
  out.push({
    q: fr
      ? `Puis-je héberger ${name} avec l’offre gratuite ?`
      : `Can I host ${name} on the Free plan?`,
    a: fr
      ? `Oui. L’offre Free comprend ${p.freeServers} serveur et ${p.freeDaily} appels d’outils par jour, sans carte bancaire. Pro coûte ${p.proMonthly} par mois (ou ${p.proAnnual} par an) pour ${p.proServers} serveurs et ${p.proDaily} appels d’outils par jour ; un premier abonnement Pro commence par ${p.trialDays} jours gratuits. Seuls les appels d’outils comptent.`
      : `Yes. The Free plan includes ${p.freeServers} server and ${p.freeDaily} tool calls a day, with no credit card. Pro costs ${p.proMonthly} a month (or ${p.proAnnual} a year) for ${p.proServers} servers and ${p.proDaily} tool calls a day; a first Pro subscription starts with ${p.trialDays} days free. Only tool calls count.`,
  });

  return out;
}

function serverMetaDescription(
  entry: ServerEntry,
  description: string,
  required: string[],
  locale: Locale
): string {
  const fr = locale === "fr";
  const name = entry.name;
  let lead: string;
  if (entry.hostMode === "local") {
    lead = fr
      ? `Serveur MCP ${name} via TwinMCP : il tourne sur votre machine avec l’agent local, connecté à Cursor, Claude, VS Code et d’autres.`
      : `The ${name} MCP server via TwinMCP: runs on your machine through the local agent, connected to Cursor, Claude, VS Code and more.`;
  } else if (required.length > 0) {
    lead = fr
      ? `Hébergez le serveur MCP ${name} sur TwinMCP : ${joinList(required, locale)} stocké${required.length > 1 ? "s" : ""} chiffré${required.length > 1 ? "s" : ""}, une URL pour Cursor, Claude, VS Code.`
      : `Host the ${name} MCP server on TwinMCP: ${joinList(required, locale)} stored encrypted, one URL for Cursor, Claude, VS Code and more.`;
  } else {
    lead = fr
      ? `Hébergez le serveur MCP ${name} sur TwinMCP, sans clé API : une box isolée, une URL pour Cursor, Claude, VS Code.`
      : `Host the ${name} MCP server on TwinMCP, no API key needed: an isolated box, one URL for Cursor, Claude, VS Code and more.`;
  }
  return clampText(`${lead} ${description}`, DESCRIPTION_MAX);
}

export function buildServerPage(entry: ServerEntry, locale: Locale): ServerPageData {
  const fr = locale === "fr";
  const launch = parseLaunch(entry.seed.startCmd);
  const fields = configFields(entry, locale);
  const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);
  const optionalKeys = fields.filter((f) => !f.required).map((f) => f.key);
  const description = localizedDescription(entry, locale);
  const name = entry.name;

  const h1 = fr ? `Héberger le serveur MCP ${name}` : `Host the ${name} MCP server`;
  const title = fitTitle(
    fr
      ? [
          `Héberger le serveur MCP ${name} · TwinMCP`,
          `Héberger le serveur MCP ${name}`,
          `Serveur MCP ${name} hébergé`,
        ]
      : [
          `Host the ${name} MCP server · TwinMCP`,
          `Host the ${name} MCP server`,
          `${name} MCP server hosting`,
        ]
  );

  return {
    locale,
    slug: entry.slug,
    name,
    description,
    categoryKey: entry.categoryKey,
    categoryLabel: categoryLabel(entry.categoryKey, locale),
    hostMode: entry.hostMode,
    launch,
    repoUrl: entry.seed.repoUrl ?? null,
    relatedBlogSlugs: entry.relatedBlogSlugs,
    fields,
    requiredKeys,
    optionalKeys,
    facts: factsFor(entry, launch, fields, locale),
    h1,
    title,
    metaDescription: serverMetaDescription(entry, description, requiredKeys, locale),
    path: serverPath(entry.slug, locale),
    languages: {
      en: serverPath(entry.slug, "en"),
      fr: serverPath(entry.slug, "fr"),
      "x-default": serverPath(entry.slug, "en"),
    },
    steps: stepsFor(entry, launch, requiredKeys, optionalKeys, locale),
    faq: faqFor(entry, launch, requiredKeys, optionalKeys, locale),
    mcpUrl: exampleMcpUrl(entry.slug, locale),
    serverUrl: exampleServerUrl(locale),
    signUpHref: SIGN_UP_PATH[locale],
    pricingHref: PRICING_PATH[locale],
    docsHref: DOCS_PATH[locale],
  };
}

/** Same-category neighbours, in seed order (for "related MCP servers" links). */
export function relatedServers(entry: ServerEntry, limit = 6): ServerEntry[] {
  return SERVERS.filter((s) => s.slug !== entry.slug && s.categoryKey === entry.categoryKey).slice(
    0,
    limit
  );
}

// ─── Per-MCP × per-client page ──────────────────────────────────────────────

const CLIENT_NOTES: Record<
  Exclude<IdeKey, "other">,
  Record<Locale, (name: string, label: string) => string[]>
> = {
  cursor: {
    en: (name) => [
      "Cursor speaks Streamable HTTP natively: the entry is the TwinMCP URL plus an Authorization header, with no bridge to install.",
      `Put it in ~/.cursor/mcp.json to have ${name} in every project, or in .cursor/mcp.json inside a single project.`,
    ],
    fr: (name) => [
      "Cursor parle Streamable HTTP nativement : l’entrée se compose de l’URL TwinMCP et d’un en-tête Authorization, sans pont à installer.",
      `Placez-la dans ~/.cursor/mcp.json pour avoir ${name} dans tous vos projets, ou dans .cursor/mcp.json pour un seul projet.`,
    ],
  },
  "claude-desktop": {
    en: () => [
      "Claude Desktop only loads local (stdio) servers, so the entry runs the mcp-remote bridge with npx: Node.js 18+ must be installed on your computer.",
      "The file is claude_desktop_config.json, in ~/Library/Application Support/Claude/ on macOS and %APPDATA%\\Claude\\ on Windows. Quit Claude Desktop completely and reopen it after saving.",
    ],
    fr: () => [
      "Claude Desktop ne charge que des serveurs locaux (stdio) : l’entrée lance donc le pont mcp-remote avec npx, et Node.js 18+ doit être installé sur votre ordinateur.",
      "Le fichier est claude_desktop_config.json, dans ~/Library/Application Support/Claude/ sous macOS et %APPDATA%\\Claude\\ sous Windows. Quittez complètement Claude Desktop puis rouvrez-le après l’enregistrement.",
    ],
  },
  "claude-code": {
    en: (name) => [
      "Claude Code registers remote servers from the terminal: the command adds an HTTP transport with the Authorization header, so there is no file to edit.",
      `Run claude mcp list afterwards to check that ${name} is registered.`,
    ],
    fr: (name) => [
      "Claude Code enregistre les serveurs distants depuis le terminal : la commande ajoute un transport HTTP avec l’en-tête Authorization, sans fichier à modifier.",
      `Lancez ensuite claude mcp list pour vérifier que ${name} est bien enregistré.`,
    ],
  },
  vscode: {
    en: () => [
      'VS Code reads MCP servers from .vscode/mcp.json in your workspace, under a top-level "servers" key, with "type": "http" for a remote URL.',
      "The file holds your API key: keep it out of a public repository.",
    ],
    fr: () => [
      'VS Code lit les serveurs MCP dans .vscode/mcp.json de votre espace de travail, sous une clé "servers", avec "type": "http" pour une URL distante.',
      "Le fichier contient votre clé API : ne le publiez pas dans un dépôt public.",
    ],
  },
  windsurf: {
    en: () => [
      "Windsurf points at a remote MCP server with serverUrl (not url), in ~/.codeium/windsurf/mcp_config.json.",
      "Add the entry next to the servers already under mcpServers rather than replacing the file.",
    ],
    fr: () => [
      "Windsurf désigne un serveur MCP distant par serverUrl (et non url), dans ~/.codeium/windsurf/mcp_config.json.",
      "Ajoutez l’entrée à côté des serveurs déjà présents sous mcpServers plutôt que de remplacer le fichier.",
    ],
  },
  cline: {
    en: () => [
      "Cline keeps its servers in cline_mcp_settings.json: open MCP Servers, then Configure, in the Cline panel.",
      'The entry sets "type": "streamableHttp" so Cline talks Streamable HTTP to the TwinMCP URL.',
    ],
    fr: () => [
      "Cline conserve ses serveurs dans cline_mcp_settings.json : ouvrez MCP Servers puis Configure dans le panneau Cline.",
      'L’entrée précise "type": "streamableHttp" pour que Cline parle Streamable HTTP à l’URL TwinMCP.',
    ],
  },
  zed: {
    en: () => [
      "Zed's context servers are local (stdio) processes, so the entry runs the mcp-remote bridge with npx: Node.js 18+ must be installed.",
      "Add it under context_servers in ~/.config/zed/settings.json.",
    ],
    fr: () => [
      "Les context servers de Zed sont des processus locaux (stdio) : l’entrée lance donc le pont mcp-remote avec npx, et Node.js 18+ doit être installé.",
      "Ajoutez-la sous context_servers dans ~/.config/zed/settings.json.",
    ],
  },
};

export interface TroubleshootingItem {
  title: string;
  text: string;
  href: string;
}

export interface ClientPageData {
  locale: Locale;
  server: ServerPageData;
  client: IdeKey;
  clientLabel: string;
  snippet: ClientSnippetView;
  h1: string;
  title: string;
  metaDescription: string;
  path: string;
  /** hreflang map; French only when the FR guide exists. */
  languages: Record<string, string>;
  /** Client specifics, then what this MCP's config means for the client. */
  notes: string[];
  steps: StepData[];
  troubleshooting: TroubleshootingItem[];
}

function clientNotes(server: ServerPageData, snippet: ClientSnippetView): string[] {
  const fr = server.locale === "fr";
  const name = server.name;
  const label = snippet.label;
  const notes = [
    ...CLIENT_NOTES[snippet.client as Exclude<IdeKey, "other">][server.locale](name, label),
  ];
  if (server.requiredKeys.length > 0) {
    notes.push(
      fr
        ? `${joinList(server.requiredKeys, "fr")} ${server.requiredKeys.length > 1 ? "restent" : "reste"} sur TwinMCP : la configuration de ${label} ne contient que l’URL TwinMCP et votre clé API.`
        : `${joinList(server.requiredKeys, "en")} ${server.requiredKeys.length > 1 ? "stay" : "stays"} on TwinMCP: the ${label} config only holds the TwinMCP URL and your API key.`
    );
  } else {
    notes.push(
      fr
        ? `${name} ne demande aucune clé API : une fois installé sur votre serveur, il répond dès que ${label} se connecte.`
        : `${name} needs no API key: once it is installed on your server, it answers as soon as ${label} connects.`
    );
  }
  if (server.hostMode === "local") {
    notes.push(
      fr
        ? `${name} tourne sur votre machine : ${LOCAL_AGENT.fr} doit être lancé pour que ${label} l’atteigne.`
        : `${name} runs on your machine: ${LOCAL_AGENT.en} must be running for ${label} to reach it.`
    );
  }
  return notes;
}

function clientSteps(server: ServerPageData, snippet: ClientSnippetView): StepData[] {
  const fr = server.locale === "fr";
  const label = snippet.label;
  const [create, install] = server.steps;
  const file = configFileName(snippet);
  const generate: StepData = {
    name: fr ? "Générer une clé" : "Generate a key",
    text: fr
      ? `Ouvrez le panneau Connect du serveur, choisissez ${label} et générez une clé API.`
      : `Open the server's Connect panel, pick ${label} and generate an API key.`,
  };
  const add: StepData = snippet.command
    ? {
        name: fr ? `Ajouter à ${label}` : `Add to ${label}`,
        text: fr
          ? "Lancez la commande dans votre terminal, avec votre clé à la place du modèle."
          : "Run the command in your terminal, with your key in place of the placeholder.",
      }
    : {
        name: fr ? `Ajouter à ${label}` : `Add to ${label}`,
        text: fr
          ? `Collez l’entrée dans ${file ?? "le fichier de configuration"}, avec votre clé à la place du modèle, puis redémarrez ${label}.`
          : `Paste the entry into ${file ?? "the config file"}, with your key in place of the placeholder, then restart ${label}.`,
      };
  return [create!, install!, generate, add];
}

function troubleshootingFor(
  server: ServerPageData,
  snippet: ClientSnippetView
): TroubleshootingItem[] {
  const fr = server.locale === "fr";
  const docs = server.docsHref;
  const anchor = (id: string) => (fr ? `${docs}#troubleshooting` : `${docs}#${id}`);
  const label = snippet.label;
  const p = planFacts(server.locale);
  const where = configFileName(snippet) ?? (fr ? "la commande" : "the command");
  const items: TroubleshootingItem[] = [
    {
      title: fr ? "« Unauthorized » (HTTP 401)" : "“Unauthorized” (HTTP 401)",
      text: fr
        ? `La clé dans ${where} est erronée, révoquée ou encore le modèle ${API_KEY_PLACEHOLDER}. Copiez une clé valide (elle commence par ctx7sk_) puis redémarrez ${label}.`
        : `The key in ${where} is wrong, revoked, or still the placeholder ${API_KEY_PLACEHOLDER}. Copy a valid key (it starts with ctx7sk_) and restart ${label}.`,
      href: anchor("error-401"),
    },
  ];
  if (server.hostMode === "local") {
    items.push({
      title: fr ? "Agent local hors ligne" : "Local agent offline",
      text: fr
        ? `Lancez ${LOCAL_AGENT.fr} sur la machine qui héberge ${server.name}, puis réessayez.`
        : `Start ${LOCAL_AGENT.en} on the machine that hosts ${server.name}, then retry.`,
      href: anchor("troubleshooting"),
    });
  } else {
    items.push({
      title: fr
        ? "« Still installing » ou réveil en cours (HTTP 503)"
        : "“Still installing” or waking up (HTTP 503)",
      text: fr
        ? `La première installation d’un MCP prend environ une minute, le temps de télécharger ${packagePhrase(server.launch, "fr")} dans la box ; un serveur en pause met jusqu’à 30 secondes environ à se réveiller. Réessayez.`
        : `The first install of an MCP takes about a minute while ${packagePhrase(server.launch, "en")} is downloaded into the box; a paused server takes up to about 30 seconds to wake. Retry.`,
      href: anchor("error-503"),
    });
  }
  if (snippet.bridged) {
    items.push({
      title: fr ? "Le pont mcp-remote ne démarre pas" : "The mcp-remote bridge does not start",
      text: fr
        ? `${label} lance mcp-remote avec npx : installez Node.js 18+ et vérifiez que npx est dans le PATH, puis redémarrez ${label}. Le premier lancement peut prendre une minute.`
        : `${label} starts mcp-remote with npx: install Node.js 18+ and check that npx is on the PATH, then restart ${label}. The first run can take a minute.`,
      href: anchor("troubleshooting"),
    });
  }
  items.push({
    title: fr ? "« Daily limit reached » (HTTP 429)" : "“Daily limit reached” (HTTP 429)",
    text: fr
      ? `Vous avez utilisé les appels d’outils du jour : ${p.freeDaily} par jour en Free, ${p.proDaily} en Pro. Seuls les appels d’outils comptent.`
      : `You have used the day's tool calls: ${p.freeDaily} a day on Free, ${p.proDaily} on Pro. Only tool calls count.`,
    href: anchor("error-429"),
  });
  return items;
}

export function buildClientPage(
  entry: ServerEntry,
  client: IdeKey,
  locale: Locale
): ClientPageData {
  const fr = locale === "fr";
  const server = buildServerPage(entry, locale);
  const snippet = clientSnippet(entry.slug, client, locale);
  const label = snippet.label;
  const shortLabel = label.replace(/\s*\(.*\)$/, "");
  const name = entry.name;

  const h1 = fr
    ? `Utiliser le serveur MCP ${name} dans ${label}`
    : `Use the ${name} MCP server in ${label}`;
  const title = fitTitle(
    fr
      ? [
          `Utiliser le serveur MCP ${name} dans ${label} · TwinMCP`,
          `Utiliser le serveur MCP ${name} dans ${label}`,
          `Serveur MCP ${name} dans ${shortLabel}`,
          `MCP ${name} dans ${shortLabel}`,
        ]
      : [
          `Use the ${name} MCP server in ${label} · TwinMCP`,
          `Use the ${name} MCP server in ${label}`,
          `${name} MCP server in ${shortLabel}`,
          `${name} MCP in ${shortLabel}`,
        ]
  );

  const file = configFileName(snippet);
  const how = snippet.command
    ? fr
      ? "la commande à lancer"
      : "the command to run"
    : fr
      ? `l’entrée ${file ?? "de configuration"}`
      : `the ${file ?? "config"} entry`;
  const need =
    server.requiredKeys.length > 0
      ? fr
        ? `${joinList(server.requiredKeys, locale)} gardé${server.requiredKeys.length > 1 ? "s" : ""} sur TwinMCP`
        : `${joinList(server.requiredKeys, locale)} kept on TwinMCP`
      : fr
        ? "sans clé API"
        : "no API key needed";
  const metaDescription = clampText(
    fr
      ? `Ajoutez le serveur MCP ${name} à ${label} avec TwinMCP : ${how}, ${need}, et les correctifs des erreurs 401 et 503. ${server.description}`
      : `Add the ${name} MCP server to ${label} with TwinMCP: ${how}, ${need}, and fixes for 401 and 503 errors. ${server.description}`,
    DESCRIPTION_MAX
  );

  const languages: Record<string, string> = {
    en: clientPath(entry.slug, client, "en"),
    "x-default": clientPath(entry.slug, client, "en"),
  };
  if (hasFrClientGuides(entry.slug)) languages.fr = clientPath(entry.slug, client, "fr");

  return {
    locale,
    server,
    client,
    clientLabel: label,
    snippet,
    h1,
    title,
    metaDescription,
    path: clientPath(entry.slug, client, locale),
    languages,
    notes: clientNotes(server, snippet),
    steps: clientSteps(server, snippet),
    troubleshooting: troubleshootingFor(server, snippet),
  };
}

/** Resolve route params; null → the page must 404 (unknown, retired or internal slug). */
export function resolveServerParams(slug: string): ServerEntry | null {
  return getServerBySlug(slug) ?? null;
}

export function resolveClientParams(
  slug: string,
  client: string,
  locale: Locale
): { entry: ServerEntry; client: IdeKey } | null {
  const entry = getServerBySlug(slug);
  if (!entry || !isClientSlug(client)) return null;
  if (locale === "fr" && !hasFrClientGuides(slug)) return null;
  return { entry, client };
}
