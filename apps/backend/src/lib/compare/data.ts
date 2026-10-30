// Structured, sourced comparison data for the /compare hub (EN) and its French
// twin /fr/comparer. The page files only render what is here.
//
// Facts policy:
//   - Every statement about a competitor (Composio, Smithery) or the MCP
//     protocol carries a source id; each source has a URL and the date it was
//     checked. When a source changes, update the row and CHECKED_ON together.
//   - Statements about TwinMCP come from code: lib/plan-features.ts,
//     lib/wallet/pricing.ts via components/pricing/wallet-copy.ts (prepaid
//     wallet since 2026-10-29: usage-based, no subscription, stops at zero),
//     lib/mcp/client-config.ts (per-MCP URL, whole-server URL, ?mode=router),
//     lib/auth/key-scope.ts (full | mcp_proxy, optionally bound to a server),
//     lib/servers/seed-catalog.ts (catalogue size, derived below).
//   - Honest by construction: each comparison says when the other option is the
//     better choice. No SLA, SSO, certification, region, data residency,
//     always-on or refund promise on the TwinMCP side. No ratings, no customers.
//   - Composio's May 2026 security incident is deliberately not used here: a
//     comparison page is not the place to argue about it.

import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { OFFICIAL_MCPS, RETIRED_SLUGS } from "@/lib/servers/seed-catalog";
import { INTERNAL_SLUGS } from "@/lib/servers/catalog";
import { walletFacts } from "@/components/pricing/wallet-copy";
import type { Locale } from "@/lib/i18n/locales";

type L<T> = Record<Locale, T>;

/** The day every external source below was last checked (ISO date). */
export const CHECKED_ON = "2026-10-27";

/**
 * MCPs in the TwinMCP catalogue: the seeded official entries
 * (lib/servers/seed-catalog.ts, what scripts/seed-mcps.ts upserts) minus the
 * retired ones and the internal docs MCP every server gets automatically —
 * the same set /servers lists. Derived, so the copy cannot drift.
 */
export const CATALOGUE_COUNT = OFFICIAL_MCPS.filter(
  (m) => !RETIRED_SLUGS.includes(m.slug) && !INTERNAL_SLUGS.includes(m.slug)
).length;

// ─── Plan facts (single sources of truth) ──────────────────────────────────────

const free = PLAN_CAPABILITIES.free;
const pro = PLAN_CAPABILITIES.pro;
const W = { en: walletFacts("en"), fr: walletFacts("fr") } as const;

/** TwinMCP's pricing line, shared by the three comparisons. */
const TWINMCP_PRICE: L<string> = {
  en: `No subscription: a prepaid balance, topped up from ${W.en.minTopup}. Tool calls ${W.en.per1000Calls} per 1,000; compute per active CPU-hour, ${W.en.cpuHour.small} on a small server (${W.en.largerSizes}). At zero, calls stop: nothing is billed beyond the balance unless you turn on auto-recharge, which has a monthly cap.`,
  fr: `Sans abonnement : un solde prépayé, rechargé à partir de ${W.fr.minTopup}. Appels d’outils ${W.fr.per1000Calls} les 1 000 ; calcul à l’heure de CPU actif, ${W.fr.cpuHour.small} sur un petit serveur (${W.fr.largerSizes}). À zéro, les appels s’arrêtent : rien n’est facturé au-delà du solde, sauf si vous activez la recharge automatique, plafonnée chaque mois.`,
};

const TWINMCP_OWN_MCP: L<string> = {
  en: "Once your account is funded (after a first top-up), publish any MCP server shipped as an npm or PyPI package, stdio included: TwinMCP installs it in your isolated server and bridges it to Streamable HTTP. It stays private to your account. Servers that only ship as a Docker image cannot run.",
  fr: "Une fois votre compte alimenté (après une première recharge), publiez tout serveur MCP distribué en paquet npm ou PyPI, stdio compris : TwinMCP l’installe dans votre serveur isolé et le relie en Streamable HTTP. Il reste privé à votre compte. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner.",
};

const TWINMCP_SECRETS: L<string> = {
  en: "You paste each MCP's API token or connection string into its config form. Secret fields are encrypted at rest (AES-256-GCM) in that MCP's config; a value several MCPs need can live once in your account vault and be referenced as {{secret:NAME}}.",
  fr: "Vous collez le token d’API ou la chaîne de connexion de chaque MCP dans son formulaire de configuration. Les champs secrets sont chiffrés au repos (AES-256-GCM) dans la configuration de ce MCP ; une valeur dont plusieurs MCP ont besoin peut être rangée une seule fois dans le coffre de votre compte et référencée par {{secret:NOM}}.",
};

const TWINMCP_URLS: L<string> = {
  en: "One URL for the whole server (recommended; tools named <mcp>__<tool>), or one URL per MCP. With ?mode=router, the server URL lists three meta-tools instead (search_tools, get_tool_schema, call_tool) for large tool sets.",
  fr: "Une seule URL pour tout le serveur (recommandé ; outils nommés <mcp>__<tool>), ou une URL par MCP. Avec ?mode=router, l’URL du serveur expose trois méta-outils à la place (search_tools, get_tool_schema, call_tool), pour les gros ensembles d’outils.",
};

const TWINMCP_CLIENTS: L<string> = {
  en: "The dashboard generates the config block for Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline and Zed; any client that speaks Streamable HTTP works.",
  fr: "Le tableau de bord génère le bloc de configuration pour Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline et Zed ; tout client qui parle Streamable HTTP fonctionne.",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CompareSlug = "composio" | "smithery" | "self-hosting";

export interface CompareSource {
  id: string;
  label: string;
  url: string;
  checkedOn: string;
}

export interface CompareRow {
  id: string;
  criterion: L<string>;
  them: L<string>;
  twinmcp: L<string>;
  /** Source ids backing the `them` cell. Required whenever it states a fact
   *  about a third party (the test enforces it for Composio and Smithery). */
  sources: string[];
}

export interface CompareFaqItem {
  q: string;
  a: string;
}

export interface CompareLink {
  href: string;
  label: string;
}

export interface Comparison {
  slug: CompareSlug;
  /** Slug under /fr/comparer. */
  frSlug: string;
  /** The other option's name, as a column header. */
  them: L<string>;
  /** <title> (the root layout appends " · TwinMCP"). */
  title: L<string>;
  description: L<string>;
  eyebrow: L<string>;
  headline: L<string>;
  lead: L<string>;
  /** One line for the hub card. */
  summary: L<string>;
  /** Optional dated notice shown above the table (info tint). */
  notice?: L<{ text: string; link?: CompareLink }>;
  rows: CompareRow[];
  /** Heading of the "choose the other option" card. */
  chooseThemTitle: L<string>;
  chooseThem: L<string[]>;
  chooseTwinmcp: L<string[]>;
  faq: L<CompareFaqItem[]>;
  /** Further reading on twinmcp.fr, per locale. */
  related: L<CompareLink[]>;
  sources: CompareSource[];
}

// ─── Sources ───────────────────────────────────────────────────────────────────

function source(id: string, label: string, url: string): CompareSource {
  return { id, label, url, checkedOn: CHECKED_ON };
}

const SRC = {
  composioPricing: source("composio-pricing", "Composio pricing", "https://composio.dev/pricing"),
  composioHome: source("composio-home", "Composio home page", "https://composio.dev/"),
  composioMcp: source("composio-mcp", "Composio docs: MCP", "https://docs.composio.dev/docs/mcp"),
  composioCustomMcp: source(
    "composio-custom-mcp",
    "Composio docs: custom MCP",
    "https://docs.composio.dev/docs/extending-sessions/custom-mcp"
  ),
  composioSecurity: source(
    "composio-security",
    "Composio docs: security",
    "https://docs.composio.dev/docs/security"
  ),
  smitheryFuture: source(
    "smithery-future",
    "Smithery: the future of Smithery",
    "https://smithery.ai/future"
  ),
  mcpTransports: source(
    "mcp-transports",
    "MCP specification: transports",
    "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"
  ),
} as const;

// ─── Comparisons ───────────────────────────────────────────────────────────────

const COMPOSIO: Comparison = {
  slug: "composio",
  frSlug: "composio",
  them: { en: "Composio", fr: "Composio" },
  title: {
    en: "TwinMCP vs Composio: an honest comparison",
    fr: "TwinMCP ou Composio : comparatif honnête",
  },
  description: {
    en: "Composio connects AI agents to 1,500+ apps with managed authentication and per-call pricing. TwinMCP hosts any MCP server, stdio included, in an isolated micro-VM, paid from a prepaid balance. Sourced facts, and when each one is the better choice.",
    fr: "Composio relie les agents IA à plus de 1 500 applications avec authentification gérée et tarif à l’appel. TwinMCP héberge n’importe quel serveur MCP, stdio compris, dans une micro-VM isolée, payé depuis un solde prépayé. Faits sourcés, et quand choisir l’un ou l’autre.",
  },
  eyebrow: { en: "TwinMCP vs Composio", fr: "TwinMCP ou Composio" },
  headline: {
    en: "Composio or TwinMCP: two different jobs",
    fr: "Composio ou TwinMCP : deux métiers différents",
  },
  lead: {
    en: "Composio is a tool platform: a large catalogue of SaaS apps with authentication handled for your users. TwinMCP is a host: it runs MCP servers, from its catalogue or your own stdio packages, each in its own isolated micro-VM. If you need the first, Composio is the better choice. This page says where the line falls.",
    fr: "Composio est une plateforme d’outils : un grand catalogue d’applications SaaS dont l’authentification est gérée pour vos utilisateurs. TwinMCP est un hébergeur : il fait tourner des serveurs MCP, ceux de son catalogue ou vos propres paquets stdio, chacun dans sa micro-VM isolée. Si vous avez besoin du premier, Composio est le meilleur choix. Cette page dit où passe la frontière.",
  },
  summary: {
    en: "1,500+ apps with managed auth, monthly plans and a per-call meter, against any MCP server hosted in its own micro-VM, paid as you go from a prepaid balance.",
    fr: "Plus de 1 500 applications avec authentification gérée, offres mensuelles et compteur à l’appel, face à n’importe quel serveur MCP hébergé dans sa micro-VM, payé à l’usage depuis un solde prépayé.",
  },
  rows: [
    {
      id: "what",
      criterion: { en: "What it is", fr: "Ce que c’est" },
      them: {
        en: "A tool-integration platform for AI agents: apps exposed through SDKs and MCP sessions, with authentication handled by Composio.",
        fr: "Une plateforme d’intégration d’outils pour agents IA : des applications exposées via SDK et sessions MCP, avec l’authentification gérée par Composio.",
      },
      twinmcp: {
        en: "Managed hosting for MCP servers: each server you create runs in its own isolated Upstash Box micro-VM, reached over Streamable HTTP.",
        fr: "De l’hébergement géré de serveurs MCP : chaque serveur que vous créez tourne dans sa propre micro-VM Upstash Box isolée, joignable en Streamable HTTP.",
      },
      sources: [SRC.composioHome.id, SRC.composioMcp.id],
    },
    {
      id: "catalogue",
      criterion: { en: "Catalogue", fr: "Catalogue" },
      them: {
        en: "1,500+ apps.",
        fr: "Plus de 1 500 applications.",
      },
      twinmcp: {
        en: `${CATALOGUE_COUNT} MCP servers in the catalogue, plus your own.`,
        fr: `${CATALOGUE_COUNT} serveurs MCP au catalogue, plus les vôtres.`,
      },
      sources: [SRC.composioHome.id],
    },
    {
      id: "own-mcp",
      criterion: {
        en: "Your own or stdio MCP servers",
        fr: "Vos propres serveurs MCP ou stdio",
      },
      them: {
        en: "Custom MCP is experimental and remote-only: “local and STDIO-only servers aren't supported”. The server must already be deployed at a public HTTPS endpoint.",
        fr: "Le MCP personnalisé est expérimental et uniquement distant : les serveurs locaux ou stdio ne sont pas pris en charge (« local and STDIO-only servers aren't supported »). Le serveur doit déjà être déployé sur un point d’accès HTTPS public.",
      },
      twinmcp: TWINMCP_OWN_MCP,
      sources: [SRC.composioCustomMcp.id],
    },
    {
      id: "auth",
      criterion: {
        en: "Third-party app authentication",
        fr: "Authentification aux applications tierces",
      },
      them: {
        en: "Composio-managed auth is the default: users connect their accounts at runtime through the session. OAuth tokens and API keys are stored encrypted by Composio.",
        fr: "L’authentification gérée par Composio est le comportement par défaut : les utilisateurs connectent leurs comptes au fil de la session. Les tokens OAuth et clés d’API sont stockés chiffrés par Composio.",
      },
      twinmcp: {
        en: `No managed OAuth for third-party apps. ${TWINMCP_SECRETS.en}`,
        fr: `Pas d’OAuth géré pour les applications tierces. ${TWINMCP_SECRETS.fr}`,
      },
      sources: [SRC.composioMcp.id, SRC.composioHome.id, SRC.composioSecurity.id],
    },
    {
      id: "url",
      criterion: { en: "Connection URL", fr: "URL de connexion" },
      them: {
        en: "A session exposes an MCP endpoint (session.mcp.url plus headers) for any MCP-compatible client, with dynamic tool access.",
        fr: "Une session expose un point d’accès MCP (session.mcp.url et ses en-têtes) pour tout client compatible MCP, avec un accès dynamique aux outils.",
      },
      twinmcp: TWINMCP_URLS,
      sources: [SRC.composioMcp.id],
    },
    {
      id: "free",
      criterion: { en: "Free to start", fr: "Pour démarrer gratuitement" },
      them: {
        en: "Hobby: $0, 100,000 tool calls a month, hard-capped, no credit card. Calls through Composio-managed apps count against it, with 20K free a month.",
        fr: "Hobby : 0 $, 100 000 appels d’outils par mois, plafond strict, sans carte bancaire. Les appels via les applications gérées par Composio y sont décomptés, avec 20 000 gratuits par mois.",
      },
      twinmcp: {
        en: `${W.en.signupCredit} of credit at sign-up, once, valid ${W.en.signupDays} days, no credit card: ${free.servers} small server, about ${W.en.creditCalls} tool calls’ worth before the compute they use. Composio's free volume is larger and renews every month.`,
        fr: `${W.fr.signupCredit} de crédit à l’inscription, une seule fois, valables ${W.fr.signupDays} jours, sans carte bancaire : ${free.servers} petit serveur, l’équivalent d’environ ${W.fr.creditCalls} appels d’outils, hors temps de calcul. Le volume gratuit de Composio est plus grand et se renouvelle chaque mois.`,
      },
      sources: [SRC.composioPricing.id],
    },
    {
      id: "paid",
      criterion: { en: "Paid usage", fr: "Usage payant" },
      them: {
        en: "Pro: $29 a month with usage credit included, then $0.0003 per tool call. Composio-managed apps add $0.0002 per call past their free allowance. Add-ons such as BAA, IP allowlist and zero data retention are billed per call.",
        fr: "Pro : 29 $ par mois, crédit d’usage inclus, puis 0,0003 $ par appel d’outil. Les applications gérées par Composio ajoutent 0,0002 $ par appel au-delà de leur quota gratuit. Les options (BAA, liste d’IP autorisées, zéro rétention des données) sont facturées à l’appel.",
      },
      twinmcp: TWINMCP_PRICE,
      sources: [SRC.composioPricing.id],
    },
    {
      id: "compliance",
      criterion: { en: "Compliance", fr: "Conformité" },
      them: {
        en: "SOC 2 Type II compliant, report available from its Trust Center. A DPA is self-serve on Pro and Enterprise.",
        fr: "Conforme SOC 2 Type II, rapport disponible dans son Trust Center. Un DPA s’accepte en libre-service sur Pro et Enterprise.",
      },
      twinmcp: {
        en: "No certification and no SLA. What TwinMCP does is documented on its security page.",
        fr: "Aucune certification et pas de SLA. Ce que fait TwinMCP est documenté sur sa page sécurité.",
      },
      sources: [SRC.composioSecurity.id, SRC.composioPricing.id],
    },
  ],
  chooseThemTitle: { en: "Choose Composio if…", fr: "Choisissez Composio si…" },
  chooseThem: {
    en: [
      "You need 1,500+ SaaS apps with managed OAuth for your end users, for example an agent where each of your customers connects their own accounts.",
      "Your procurement asks for a SOC 2 Type II report or a signed DPA.",
      "Your volume fits in 100,000 free tool calls a month, or per-call pricing matches how you use tools.",
      "Every tool you need is already a Composio toolkit, or a remote MCP server you host yourself.",
    ],
    fr: [
      "Il vous faut plus de 1 500 applications SaaS avec OAuth géré pour vos utilisateurs finaux, par exemple un agent où chacun de vos clients connecte ses propres comptes.",
      "Vos achats exigent un rapport SOC 2 Type II ou un DPA signé.",
      "Votre volume tient dans 100 000 appels d’outils gratuits par mois, ou le tarif à l’appel correspond à votre usage.",
      "Chaque outil dont vous avez besoin existe déjà comme toolkit Composio, ou comme serveur MCP distant que vous hébergez vous-même.",
    ],
  },
  chooseTwinmcp: {
    en: [
      "Your MCP server is a stdio package on npm or PyPI, open source or your own, and you do not want to deploy and run it yourself.",
      "You want each server in its own isolated micro-VM, with its own encrypted secrets.",
      "You prefer a prepaid balance that stops at zero, with no subscription, to a monthly plan with overage billing.",
      "You want one URL for all of a server's tools, router mode for large tool sets, and API keys you can limit to the MCP proxy and bind to one server.",
      "You want to be helped in French: the site, the docs and email support are in French and English, and a guided setup is available on request.",
    ],
    fr: [
      "Votre serveur MCP est un paquet stdio sur npm ou PyPI, open source ou le vôtre, et vous ne voulez pas le déployer ni l’exploiter vous-même.",
      "Vous voulez chaque serveur dans sa propre micro-VM isolée, avec ses propres secrets chiffrés.",
      "Vous préférez un solde prépayé qui s’arrête à zéro, sans abonnement, à une offre mensuelle avec dépassement facturé.",
      "Vous voulez une seule URL pour tous les outils d’un serveur, le mode routeur pour les gros ensembles d’outils, et des clés API limitées au proxy MCP et liées à un serveur.",
      "Vous voulez être accompagné en français : le site, la documentation et le support par e-mail sont en français et en anglais, et une installation accompagnée est possible sur demande.",
    ],
  },
  faq: {
    en: [
      {
        q: "Is TwinMCP a Composio alternative?",
        a: "For hosting MCP servers, yes. For managed SaaS integrations, only partly. Composio is a tool platform with 1,500+ apps and authentication it manages for your users. TwinMCP hosts MCP servers, from its catalogue or your own stdio packages, in isolated micro-VMs. If your end users must connect their own SaaS accounts through OAuth, Composio is built for that and TwinMCP is not.",
      },
      {
        q: "Can I run a stdio MCP server on Composio?",
        a: "Not as of 27 October 2026. Composio's custom MCP documentation says the feature is experimental, remote-only, and that local and STDIO-only servers aren't supported: the server must already run at a public HTTPS endpoint. TwinMCP runs stdio servers shipped as npm or PyPI packages and gives them that endpoint.",
      },
      {
        q: "Which one is cheaper?",
        a: `It depends on your volume and on how much compute your servers use. Composio's Hobby plan includes 100,000 tool calls a month for $0; TwinMCP gives ${W.en.signupCredit} of credit once, at sign-up. Above that, Composio Pro is $29 a month with usage credit, then $0.0003 per tool call; TwinMCP has no subscription: tool calls cost ${W.en.per1000Calls} per 1,000 and compute ${W.en.cpuHour.small} per active CPU-hour on a small server, paid from a prepaid balance that stops at zero. Composio's current rates are on composio.dev/pricing; TwinMCP's estimator is on its pricing page.`,
      },
      {
        q: "Does TwinMCP have SOC 2 like Composio?",
        a: `No. TwinMCP holds no certification and offers no SLA. Its security page documents what it does: one isolated micro-VM per server, secrets encrypted with AES-256-GCM, hashed API keys that can be scoped to the MCP proxy, and audit logs kept ${pro.auditRetentionDays} days once the account is funded. If a certification is a hard requirement, Composio fits better.`,
      },
      {
        q: "Can I use both?",
        a: "Yes. Both speak MCP, so the same AI client can be connected to a Composio session for SaaS apps and to a TwinMCP server for the MCP servers you host.",
      },
    ],
    fr: [
      {
        q: "TwinMCP est-il une alternative à Composio ?",
        a: "Pour héberger des serveurs MCP, oui. Pour des intégrations SaaS gérées, seulement en partie. Composio est une plateforme d’outils avec plus de 1 500 applications et une authentification qu’il gère pour vos utilisateurs. TwinMCP héberge des serveurs MCP, ceux de son catalogue ou vos propres paquets stdio, dans des micro-VM isolées. Si vos utilisateurs finaux doivent connecter leurs propres comptes SaaS par OAuth, Composio est fait pour cela, TwinMCP non.",
      },
      {
        q: "Peut-on faire tourner un serveur MCP stdio sur Composio ?",
        a: "Pas au 27 octobre 2026. La documentation de Composio sur le MCP personnalisé indique que la fonction est expérimentale, uniquement distante, et que les serveurs locaux ou stdio ne sont pas pris en charge : le serveur doit déjà tourner derrière un point d’accès HTTPS public. TwinMCP fait tourner les serveurs stdio distribués en paquets npm ou PyPI et leur fournit ce point d’accès.",
      },
      {
        q: "Lequel coûte le moins cher ?",
        a: `Cela dépend de votre volume et du calcul que consomment vos serveurs. L’offre Hobby de Composio inclut 100 000 appels d’outils par mois pour 0 $ ; TwinMCP offre ${W.fr.signupCredit} de crédit une seule fois, à l’inscription. Au-delà, Composio Pro coûte 29 $ par mois avec crédit d’usage, puis 0,0003 $ par appel d’outil ; TwinMCP n’a pas d’abonnement : les appels d’outils coûtent ${W.fr.per1000Calls} les 1 000 et le calcul ${W.fr.cpuHour.small} par heure de CPU actif sur un petit serveur, payés depuis un solde prépayé qui s’arrête à zéro. Les tarifs à jour de Composio sont sur composio.dev/pricing ; l’estimateur de TwinMCP est sur sa page tarifs.`,
      },
      {
        q: "TwinMCP a-t-il SOC 2 comme Composio ?",
        a: `Non. TwinMCP ne détient aucune certification et ne propose pas de SLA. Sa page sécurité décrit ce qu’il fait : une micro-VM isolée par serveur, des secrets chiffrés en AES-256-GCM, des clés API hachées qu’on peut limiter au proxy MCP, et des journaux d’audit conservés ${pro.auditRetentionDays} jours une fois le compte alimenté. Si une certification est indispensable, Composio convient mieux.`,
      },
      {
        q: "Peut-on utiliser les deux ?",
        a: "Oui. Les deux parlent MCP : un même client IA peut être relié à une session Composio pour les applications SaaS et à un serveur TwinMCP pour les serveurs MCP que vous hébergez.",
      },
    ],
  },
  related: {
    en: [
      { href: "/security", label: "TwinMCP security & GDPR" },
      { href: "/plans", label: "TwinMCP pricing" },
      { href: "/demo", label: "Guided setup" },
    ],
    fr: [
      { href: "/fr/securite", label: "Sécurité et RGPD chez TwinMCP" },
      { href: "/fr/tarifs", label: "Tarifs TwinMCP" },
      { href: "/fr/demo", label: "Installation accompagnée" },
    ],
  },
  sources: [
    SRC.composioHome,
    SRC.composioMcp,
    SRC.composioCustomMcp,
    SRC.composioPricing,
    SRC.composioSecurity,
  ],
};

const SMITHERY: Comparison = {
  slug: "smithery",
  frSlug: "smithery",
  them: { en: "Smithery", fr: "Smithery" },
  title: {
    en: "TwinMCP vs Smithery after the 31 October shutdown",
    fr: "TwinMCP ou Smithery après la fermeture du 31 octobre",
  },
  description: {
    en: "Smithery announced that its hosted MCP URLs, API, accounts, CLI and SDKs stop on 31 October 2026; its public registry stays. What that means next to TwinMCP, with sources, and how to move.",
    fr: "Smithery a annoncé l’arrêt de ses URL MCP hébergées, de son API, des comptes, de sa CLI et de ses SDK le 31 octobre 2026 ; son registre public reste en ligne. Ce que cela change face à TwinMCP, sources à l’appui, et comment migrer.",
  },
  eyebrow: { en: "TwinMCP vs Smithery", fr: "TwinMCP ou Smithery" },
  headline: {
    en: "Smithery keeps its directory and stops its hosting",
    fr: "Smithery garde son annuaire et arrête son hébergement",
  },
  lead: {
    en: "Smithery announced that its connection services stop on 31 October 2026. Its public registry stays online as a directory of MCP servers. TwinMCP is a host: if you ran MCP servers on Smithery's URLs, this is the part you need to replace.",
    fr: "Smithery a annoncé l’arrêt de ses services de connexion le 31 octobre 2026. Son registre public reste en ligne comme annuaire de serveurs MCP. TwinMCP est un hébergeur : si vos serveurs MCP tournaient derrière les URL de Smithery, c’est cette partie qu’il faut remplacer.",
  },
  summary: {
    en: "Smithery's hosting stops on 31 October 2026 and its registry stays; TwinMCP hosts the servers that ran there.",
    fr: "L’hébergement Smithery s’arrête le 31 octobre 2026 et son registre reste ; TwinMCP héberge les serveurs qui y tournaient.",
  },
  notice: {
    en: {
      text: "Smithery's hosted URLs, API, accounts, CLI and SDKs stop on 31 October 2026, per Smithery's own announcement.",
      link: { href: "/migrate-from-smithery", label: "Migrate from Smithery" },
    },
    fr: {
      text: "Les URL hébergées, l’API, les comptes, la CLI et les SDK de Smithery s’arrêtent le 31 octobre 2026, selon l’annonce de Smithery.",
      link: { href: "/fr/migrer-depuis-smithery", label: "Migrer depuis Smithery" },
    },
  },
  rows: [
    {
      id: "status",
      criterion: { en: "Hosting", fr: "Hébergement" },
      them: {
        en: "Connection management services shut down on 31 October 2026: server URLs on run.tools and server.smithery.ai, the API, Connect and Toolbox.",
        fr: "Les services de gestion des connexions ferment le 31 octobre 2026 : URL de serveurs sur run.tools et server.smithery.ai, l’API, Connect et Toolbox.",
      },
      twinmcp: {
        en: "Each server you create runs in its own isolated Upstash Box micro-VM, reached over Streamable HTTP.",
        fr: "Chaque serveur que vous créez tourne dans sa propre micro-VM Upstash Box isolée, joignable en Streamable HTTP.",
      },
      sources: [SRC.smitheryFuture.id],
    },
    {
      id: "registry",
      criterion: { en: "Catalogue", fr: "Catalogue" },
      them: {
        en: "The public registry at smithery.ai stays as a directory of MCP servers, now powered by Arcade.dev. Verified servers' pages list the vendor's direct MCP URL.",
        fr: "Le registre public sur smithery.ai reste comme annuaire de serveurs MCP, désormais propulsé par Arcade.dev. Les pages des serveurs vérifiés indiquent l’URL MCP directe de l’éditeur.",
      },
      twinmcp: {
        en: `${CATALOGUE_COUNT} MCP servers you install and run on your own TwinMCP server. Not an open registry: smaller, and each one runs in your sandbox.`,
        fr: `${CATALOGUE_COUNT} serveurs MCP à installer et faire tourner sur votre serveur TwinMCP. Pas un registre ouvert : plus petit, et chacun tourne dans votre sandbox.`,
      },
      sources: [SRC.smitheryFuture.id],
    },
    {
      id: "own-mcp",
      criterion: {
        en: "Your own or stdio MCP servers",
        fr: "Vos propres serveurs MCP ou stdio",
      },
      them: {
        en: "No hosting after 31 October 2026: the hosted server URLs stop.",
        fr: "Plus d’hébergement après le 31 octobre 2026 : les URL de serveurs hébergés s’arrêtent.",
      },
      twinmcp: TWINMCP_OWN_MCP,
      sources: [SRC.smitheryFuture.id],
    },
    {
      id: "accounts",
      criterion: { en: "Accounts and keys", fr: "Comptes et clés" },
      them: {
        en: "Smithery accounts and API keys shut down on 31 October 2026.",
        fr: "Les comptes et clés API Smithery ferment le 31 octobre 2026.",
      },
      twinmcp: {
        en: "API keys starting with ctx7sk_, either full-account or limited to the MCP proxy and optionally bound to one server.",
        fr: "Des clés API qui commencent par ctx7sk_, soit complètes, soit limitées au proxy MCP et éventuellement liées à un seul serveur.",
      },
      sources: [SRC.smitheryFuture.id],
    },
    {
      id: "tooling",
      criterion: { en: "Client setup", fr: "Configuration des clients" },
      them: {
        en: "The Smithery CLI and SDKs stop working; their current versions are marked deprecated.",
        fr: "La CLI et les SDK Smithery cessent de fonctionner ; leurs versions actuelles sont marquées obsolètes.",
      },
      twinmcp: TWINMCP_CLIENTS,
      sources: [SRC.smitheryFuture.id],
    },
    {
      id: "url",
      criterion: { en: "Connection URL", fr: "URL de connexion" },
      them: {
        en: "Server URLs on run.tools and server.smithery.ai stop answering on 31 October 2026.",
        fr: "Les URL de serveurs sur run.tools et server.smithery.ai cessent de répondre le 31 octobre 2026.",
      },
      twinmcp: TWINMCP_URLS,
      sources: [SRC.smitheryFuture.id],
    },
    {
      id: "price",
      criterion: { en: "Price", fr: "Prix" },
      them: {
        en: "No hosting plan to buy after 31 October 2026.",
        fr: "Plus d’offre d’hébergement à souscrire après le 31 octobre 2026.",
      },
      twinmcp: TWINMCP_PRICE,
      sources: [SRC.smitheryFuture.id],
    },
  ],
  chooseThemTitle: {
    en: "Use Smithery's registry if…",
    fr: "Utilisez le registre Smithery si…",
  },
  chooseThem: {
    en: [
      "You only need to discover MCP servers: the public directory at smithery.ai stays online.",
      "The server you use is published by its vendor as a remote MCP URL: point your client at that URL directly, no host needed.",
    ],
    fr: [
      "Vous avez seulement besoin de découvrir des serveurs MCP : l’annuaire public sur smithery.ai reste en ligne.",
      "Le serveur que vous utilisez est publié par son éditeur sous forme d’URL MCP distante : pointez votre client directement dessus, sans hébergeur.",
    ],
  },
  chooseTwinmcp: {
    en: [
      "You ran open-source or stdio MCP servers behind Smithery's URLs and need a new host for them.",
      "You want your MCP secrets stored server-side and encrypted, not copied into every laptop's config.",
      "You want one dashboard that writes the config for Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline and Zed.",
      `You want to start on ${W.en.signupCredit} of free credit and top up only when one server is not enough.`,
    ],
    fr: [
      "Vos serveurs MCP open source ou stdio tournaient derrière les URL de Smithery et il leur faut un nouvel hébergeur.",
      "Vous voulez des secrets MCP stockés côté serveur et chiffrés, plutôt que copiés dans la configuration de chaque poste.",
      "Vous voulez un tableau de bord qui écrit la configuration pour Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline et Zed.",
      `Vous voulez commencer avec ${W.fr.signupCredit} de crédit offert et ne recharger que quand un serveur ne suffit plus.`,
    ],
  },
  faq: {
    en: [
      {
        q: "What exactly stops on 31 October 2026?",
        a: "According to smithery.ai/future: Smithery's connection management services, the server URLs on run.tools and server.smithery.ai, the Smithery API, Connect and Toolbox, Smithery accounts and API keys, and the Smithery CLI and SDKs. Smithery's announcement is the reference for the exact scope.",
      },
      {
        q: "Does the Smithery registry stay?",
        a: "Yes. Smithery says the public registry at smithery.ai stays as a directory of MCP servers, now powered by Arcade.dev, and that verified servers' pages list the vendor's direct MCP URL. A directory lists servers; it does not run them.",
      },
      {
        q: "Is TwinMCP's catalogue as large as Smithery's registry?",
        a: `No. TwinMCP's catalogue holds ${CATALOGUE_COUNT} MCP servers, not an open registry. For a server outside it, publish its npm or PyPI package as your own MCP once your account is funded. Servers that only ship as a Docker image cannot run in the sandbox.`,
      },
      {
        q: "How do I move from Smithery to TwinMCP?",
        a: "Install the same MCPs on a TwinMCP server, paste your secrets into each MCP's config form, then replace the Smithery entry in your AI client with the block the dashboard generates. The step-by-step guide is on the Migrate from Smithery page.",
      },
    ],
    fr: [
      {
        q: "Qu’est-ce qui s’arrête exactement le 31 octobre 2026 ?",
        a: "Selon smithery.ai/future : les services de gestion des connexions de Smithery, les URL de serveurs sur run.tools et server.smithery.ai, l’API Smithery, Connect et Toolbox, les comptes et clés API Smithery, ainsi que la CLI et les SDK Smithery. L’annonce de Smithery fait référence pour le périmètre exact.",
      },
      {
        q: "Le registre Smithery reste-t-il en ligne ?",
        a: "Oui. Smithery indique que le registre public sur smithery.ai reste comme annuaire de serveurs MCP, désormais propulsé par Arcade.dev, et que les pages des serveurs vérifiés donnent l’URL MCP directe de l’éditeur. Un annuaire liste des serveurs ; il ne les fait pas tourner.",
      },
      {
        q: "Le catalogue TwinMCP est-il aussi grand que le registre Smithery ?",
        a: `Non. Le catalogue TwinMCP compte ${CATALOGUE_COUNT} serveurs MCP, ce n’est pas un registre ouvert. Pour un serveur absent, publiez son paquet npm ou PyPI comme MCP privé une fois votre compte alimenté. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner dans le sandbox.`,
      },
      {
        q: "Comment passer de Smithery à TwinMCP ?",
        a: "Installez les mêmes MCP sur un serveur TwinMCP, collez vos secrets dans le formulaire de configuration de chaque MCP, puis remplacez l’entrée Smithery de votre client IA par le bloc que génère le tableau de bord. Le pas-à-pas est sur la page Migrer depuis Smithery.",
      },
    ],
  },
  related: {
    en: [
      { href: "/migrate-from-smithery", label: "Migrate from Smithery, step by step" },
      { href: "/blog/smithery-alternatives", label: "Smithery alternatives" },
      { href: "/blog/smithery-vs-twinmcp", label: "Smithery vs TwinMCP vs self-host" },
    ],
    fr: [
      { href: "/fr/migrer-depuis-smithery", label: "Migrer depuis Smithery, pas à pas" },
      { href: "/fr/blog/smithery-alternatives", label: "Les alternatives à Smithery" },
    ],
  },
  sources: [SRC.smitheryFuture],
};

const SELF_HOSTING: Comparison = {
  slug: "self-hosting",
  frSlug: "auto-hebergement",
  them: { en: "Self-hosting", fr: "Auto-hébergement" },
  title: {
    en: "TwinMCP vs self-hosting your MCP servers",
    fr: "TwinMCP ou auto-héberger ses serveurs MCP",
  },
  description: {
    en: "Self-hosting MCP servers gives you full control and full operations: TLS, auth, isolation, secrets, uptime. TwinMCP runs them pay as you go, with trade-offs it states. When each one is the better choice.",
    fr: "Auto-héberger ses serveurs MCP, c’est tout le contrôle et toute l’exploitation : TLS, authentification, isolation, secrets, disponibilité. TwinMCP les fait tourner en paiement à l’usage, avec des limites qu’il annonce. Quand choisir l’un ou l’autre.",
  },
  eyebrow: { en: "TwinMCP vs self-hosting", fr: "TwinMCP ou auto-hébergement" },
  headline: {
    en: "Run it yourself, or have it run",
    fr: "L’exploiter vous-même, ou le faire exploiter",
  },
  lead: {
    en: "An MCP server's code is portable; the work is in running it. Self-hosting gives you control over everything and the operations that come with it. TwinMCP takes the operations and leaves you with its limits. Both are reasonable; here is the trade.",
    fr: "Le code d’un serveur MCP est portable ; le travail, c’est de le faire tourner. L’auto-hébergement vous donne la main sur tout, et l’exploitation qui va avec. TwinMCP prend l’exploitation et vous laisse ses limites. Les deux se défendent ; voici l’arbitrage.",
  },
  summary: {
    en: "Full control and full operations, against a managed host with stated limits.",
    fr: "Tout le contrôle et toute l’exploitation, face à un hébergeur géré aux limites annoncées.",
  },
  rows: [
    {
      id: "setup",
      criterion: { en: "Setup", fr: "Mise en place" },
      them: {
        en: "You choose a host, deploy each server, and expose stdio servers over HTTP yourself: stdio servers talk over stdin and stdout, remote clients need Streamable HTTP.",
        fr: "Vous choisissez un hébergeur, déployez chaque serveur et exposez vous-même les serveurs stdio en HTTP : un serveur stdio parle par stdin et stdout, un client distant a besoin de Streamable HTTP.",
      },
      twinmcp: {
        en: "Pick an MCP from the catalogue or publish a package: TwinMCP installs it in an isolated server and gives you a URL and an API key.",
        fr: "Choisissez un MCP au catalogue ou publiez un paquet : TwinMCP l’installe dans un serveur isolé et vous donne une URL et une clé API.",
      },
      sources: [SRC.mcpTransports.id],
    },
    {
      id: "runs",
      criterion: { en: "What can run", fr: "Ce qui peut tourner" },
      them: {
        en: "Anything, including servers that only ship as a Docker image.",
        fr: "Tout, y compris les serveurs distribués uniquement en image Docker.",
      },
      twinmcp: TWINMCP_OWN_MCP,
      sources: [],
    },
    {
      id: "auth",
      criterion: { en: "TLS and authentication", fr: "TLS et authentification" },
      them: {
        en: "Yours to add in front of every server; the MCP specification says servers should authenticate all connections.",
        fr: "À ajouter vous-même devant chaque serveur ; la spécification MCP demande d’authentifier toutes les connexions.",
      },
      twinmcp: {
        en: "HTTPS and bearer API keys (ctx7sk_), either full-account or limited to the MCP proxy and optionally bound to one server.",
        fr: "HTTPS et clés API bearer (ctx7sk_), soit complètes, soit limitées au proxy MCP et éventuellement liées à un seul serveur.",
      },
      sources: [SRC.mcpTransports.id],
    },
    {
      id: "isolation",
      criterion: { en: "Isolation", fr: "Isolation" },
      them: {
        en: "Your design: one container per server, a shared host, or separate machines.",
        fr: "À concevoir : un conteneur par serveur, un hôte partagé ou des machines séparées.",
      },
      twinmcp: {
        en: "One Upstash Box micro-VM per server.",
        fr: "Une micro-VM Upstash Box par serveur.",
      },
      sources: [],
    },
    {
      id: "secrets",
      criterion: { en: "Secrets", fr: "Secrets" },
      them: {
        en: "Wherever you keep them: environment files, a secrets manager, your CI.",
        fr: "Là où vous les rangez : fichiers d’environnement, gestionnaire de secrets, votre CI.",
      },
      twinmcp: TWINMCP_SECRETS,
      sources: [],
    },
    {
      id: "availability",
      criterion: { en: "Availability", fr: "Disponibilité" },
      them: {
        en: "Always on if you keep it on. Uptime is yours to run.",
        fr: "Allumé en permanence si vous le gardez allumé. La disponibilité est à votre charge.",
      },
      twinmcp: {
        en: "Idle servers sleep: the first request after a pause takes a few seconds longer. Calls stop when the prepaid balance reaches zero. No SLA.",
        fr: "Les serveurs inactifs se mettent en veille : la première requête après une pause prend quelques secondes de plus. Les appels s’arrêtent quand le solde prépayé atteint zéro. Pas de SLA.",
      },
      sources: [],
    },
    {
      id: "logs",
      criterion: { en: "Logs and audit", fr: "Journaux et audit" },
      them: {
        en: "Whatever you set up.",
        fr: "Ce que vous mettez en place.",
      },
      twinmcp: {
        en: `Live logs per server, a tool-call activity log (metadata only, ${free.activityRetentionDays} days before the first top-up, ${pro.activityRetentionDays} after) and audit logs kept ${pro.auditRetentionDays} days on a funded account.`,
        fr: `Journaux en direct par serveur, un journal d’activité des appels d’outils (métadonnées seulement, ${free.activityRetentionDays} jours avant la première recharge, ${pro.activityRetentionDays} après) et des journaux d’audit conservés ${pro.auditRetentionDays} jours sur un compte alimenté.`,
      },
      sources: [],
    },
    {
      id: "location",
      criterion: { en: "Network and location", fr: "Réseau et localisation" },
      them: {
        en: "Your network, your region, your VPC.",
        fr: "Votre réseau, votre région, votre VPC.",
      },
      twinmcp: {
        en: "TwinMCP's infrastructure. No region choice.",
        fr: "L’infrastructure de TwinMCP. Pas de choix de région.",
      },
      sources: [],
    },
    {
      id: "cost",
      criterion: { en: "Cost", fr: "Coût" },
      them: {
        en: "Your host's price, plus the time spent operating it.",
        fr: "Le prix de votre hébergeur, plus le temps passé à l’exploiter.",
      },
      twinmcp: TWINMCP_PRICE,
      sources: [],
    },
  ],
  chooseThemTitle: { en: "Self-host if…", fr: "Auto-hébergez si…" },
  chooseThem: {
    en: [
      "Compliance requires the servers to run in your own network, VPC or region.",
      "You already run infrastructure, and one more container is trivial for your team.",
      "Your MCP server only ships as a Docker image.",
      "You need it always on, with no cold start.",
    ],
    fr: [
      "La conformité impose que les serveurs tournent dans votre propre réseau, VPC ou région.",
      "Vous exploitez déjà de l’infrastructure, et un conteneur de plus ne coûte rien à votre équipe.",
      "Votre serveur MCP n’est distribué qu’en image Docker.",
      "Il vous le faut allumé en permanence, sans démarrage à froid.",
    ],
  },
  chooseTwinmcp: {
    en: [
      "Nobody on your team wants to run TLS, authentication, process supervision and stdio bridging for MCP servers.",
      "You want per-server isolation and encrypted secrets without designing them.",
      "You want the config for seven AI clients generated for you.",
      `You want to start on ${W.en.signupCredit} of free credit and keep the option to leave: the MCP code stays portable.`,
    ],
    fr: [
      "Personne dans votre équipe ne veut gérer TLS, authentification, supervision des processus et pont stdio pour des serveurs MCP.",
      "Vous voulez l’isolation par serveur et des secrets chiffrés sans avoir à les concevoir.",
      "Vous voulez qu’on génère pour vous la configuration de sept clients IA.",
      `Vous voulez commencer avec ${W.fr.signupCredit} de crédit offert en gardant la porte ouverte : le code MCP reste portable.`,
    ],
  },
  faq: {
    en: [
      {
        q: "Is self-hosting cheaper than TwinMCP?",
        a: `In money, it can be, especially for a server that is busy all day: TwinMCP charges for active CPU time (${W.en.cpuHour.small} per CPU-hour on a small server) and tool calls (${W.en.per1000Calls} per 1,000), while a small VPS costs the same however busy it is. In time, you run TLS, authentication, updates, logs and isolation yourself. TwinMCP gives ${W.en.signupCredit} of free credit at sign-up, so you can compare on a real server first.`,
      },
      {
        q: "Can I move from TwinMCP to self-hosting later?",
        a: "Yes. An MCP server's code is portable: install the same npm or PyPI package on your own host, run it with an HTTP transport, and point your clients at the new URL. Nothing in your MCP is specific to TwinMCP.",
      },
      {
        q: "What can self-hosting do that TwinMCP cannot?",
        a: "Run servers that only ship as a Docker image, keep them always on, place them in a region or network you choose, and back them with an SLA you set yourself. TwinMCP does none of these today.",
      },
      {
        q: "How does TwinMCP run a stdio MCP server?",
        a: "It installs the package in your server's isolated micro-VM, bridges the server's stdin and stdout to Streamable HTTP, and puts its authenticated proxy in front. Your client gets a URL and an API key, like any remote MCP server.",
      },
    ],
    fr: [
      {
        q: "L’auto-hébergement coûte-t-il moins cher que TwinMCP ?",
        a: `En argent, c’est possible, surtout pour un serveur occupé toute la journée : TwinMCP facture le temps CPU actif (${W.fr.cpuHour.small} par heure CPU sur un petit serveur) et les appels d’outils (${W.fr.per1000Calls} les 1 000), alors qu’un petit VPS coûte le même prix quelle que soit sa charge. En temps, vous gérez vous-même TLS, authentification, mises à jour, journaux et isolation. TwinMCP offre ${W.fr.signupCredit} de crédit à l’inscription : vous pouvez d’abord comparer sur un vrai serveur.`,
      },
      {
        q: "Peut-on passer de TwinMCP à l’auto-hébergement plus tard ?",
        a: "Oui. Le code d’un serveur MCP est portable : installez le même paquet npm ou PyPI sur votre propre hôte, lancez-le avec un transport HTTP et pointez vos clients vers la nouvelle URL. Rien dans votre MCP n’est propre à TwinMCP.",
      },
      {
        q: "Que permet l’auto-hébergement que TwinMCP ne permet pas ?",
        a: "Faire tourner des serveurs distribués uniquement en image Docker, les garder allumés en permanence, les placer dans la région ou le réseau de votre choix, et les adosser à un SLA que vous fixez vous-même. TwinMCP ne fait rien de cela aujourd’hui.",
      },
      {
        q: "Comment TwinMCP fait-il tourner un serveur MCP stdio ?",
        a: "Il installe le paquet dans la micro-VM isolée de votre serveur, relie le stdin et le stdout du serveur au Streamable HTTP, et place devant son proxy authentifié. Votre client reçoit une URL et une clé API, comme pour n’importe quel serveur MCP distant.",
      },
    ],
  },
  related: {
    en: [
      { href: "/blog/managed-vs-self-hosted-mcp", label: "Managed vs self-hosted MCP" },
      { href: "/blog/mcp-server-hosting", label: "MCP server hosting in 2026" },
      { href: "/security", label: "TwinMCP security & GDPR" },
    ],
    fr: [
      { href: "/fr/blog/managed-vs-self-hosted-mcp", label: "MCP géré ou auto-hébergé" },
      { href: "/fr/blog/mcp-server-hosting", label: "Héberger un serveur MCP en 2026" },
      { href: "/fr/securite", label: "Sécurité et RGPD chez TwinMCP" },
    ],
  },
  sources: [SRC.mcpTransports],
};

export const COMPARISONS: readonly Comparison[] = [COMPOSIO, SMITHERY, SELF_HOSTING];

// ─── Paths and lookups (pure) ──────────────────────────────────────────────────

/** The hub, per locale. */
export const COMPARE_BASE = { en: "/compare", fr: "/fr/comparer" } as const satisfies L<string>;

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

export function getComparisonByFrSlug(frSlug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.frSlug === frSlug);
}

/** The hub (no comparison) or one comparison page, in `locale`. */
export function comparePath(locale: Locale, comparison?: Comparison): string {
  if (!comparison) return COMPARE_BASE[locale];
  return `${COMPARE_BASE[locale]}/${locale === "fr" ? comparison.frSlug : comparison.slug}`;
}

/** `alternates.languages` for Next.js metadata: symmetric en/fr pair + x-default (EN). */
export function compareLanguages(comparison?: Comparison): Record<string, string> {
  const en = comparePath("en", comparison);
  return { en, fr: comparePath("fr", comparison), "x-default": en };
}

/** Every EN/FR page pair of the compare section (hub first). Mirrors the
 *  TRANSLATED_TWINS entries in lib/i18n/locales.ts, which a test checks. */
export function compareTwinPairs(): { en: string; fr: string }[] {
  return [undefined, ...COMPARISONS].map((c) => ({
    en: comparePath("en", c),
    fr: comparePath("fr", c),
  }));
}

/** 1-based footnote number of a source within its comparison, or 0 if unknown. */
export function sourceNumber(comparison: Comparison, sourceId: string): number {
  return comparison.sources.findIndex((s) => s.id === sourceId) + 1;
}

/** "27 October 2026" / "27 octobre 2026" for a YYYY-MM-DD date (UTC, no clock). */
export function formatCheckedOn(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = {
    en: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    fr: [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ],
  } as const;
  const month = months[locale][m - 1];
  if (!y || !month || !d) return iso;
  return `${d} ${month} ${y}`;
}
