import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Locale } from "@/lib/i18n/locales";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { Section } from "./section";

const EN = walletFacts("en");
const FR = walletFacts("fr");

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

// Plain-text variant exported for JSON-LD FAQPage schema reuse. The home FAQ
// answers the objections that stop a sign-up: price (prepaid wallet, prices
// from lib/wallet/pricing.ts), what happens when the credit runs out, setup,
// clients, security — facts only.
export const defaultFaqItems: { q: string; a: string }[] = [
  {
    q: "How much does TwinMCP cost?",
    a: `You pay as you go, with no subscription. Every new account gets ${EN.signupCredit} of free credit, no card, valid ${EN.signupDays} days: enough for ${EN.creditServers} server with up to ${FREE_MCP_LIMIT} MCPs plus TwinMCP Docs. After that you top up a prepaid balance from ${EN.minTopup}. Tool calls cost ${EN.per1000Calls} per 1,000 and compute ${EN.cpuHour.small} per active CPU-hour on a small server.`,
  },
  {
    q: "Does connecting my IDE use up my credit?",
    a: "No. Only tool calls are charged — the requests where your AI actually asks an MCP to do something. Connecting, listing tools, pings and session handshakes are free, so reconnecting a client or switching IDEs costs nothing.",
  },
  {
    q: "Can I get a surprise bill?",
    a: "No. TwinMCP is prepaid: you can only spend the credit in your balance. When it reaches zero, tool calls are refused with a clear message and your servers pause. Nothing is charged to a card unless you turn on auto-recharge, which has a monthly cap you set.",
  },
  {
    q: "What happens when the free credit runs out?",
    a: `Nothing is charged: with no card on file, nothing can be. Calls stop until you top up from ${EN.minTopup}, whenever you decide. Your first top-up also unlocks up to ${EN.fundedServers} servers and every box size.`,
  },
  {
    q: "Do I need Docker or a VPS?",
    a: "No. Pick an MCP from the catalog: TwinMCP installs it in your isolated server and gives you a URL and an API key. It takes about 2 minutes.",
  },
  {
    q: "Can I host an MCP server that isn't in the catalogue?",
    a: "Yes, once your account is funded (after your first top-up). Publish any MCP server shipped as an npm or PyPI package, stdio servers included: TwinMCP installs it in your isolated server, bridges stdio to Streamable HTTP and gives it a URL like any catalogue MCP. It stays private to your account. Servers that only ship as a Docker image cannot run in the sandbox today.",
  },
  {
    q: "Which AI clients are supported?",
    a: "Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline and Zed, plus any client that speaks Streamable HTTP. The dashboard generates the exact config block for each one, so the same hosted server works in all of them: configure it once, switch IDEs without reinstalling.",
  },
  {
    q: "Are my secrets safe?",
    a: "Each server runs in its own isolated sandbox, an Upstash Box micro-VM. Secrets such as API tokens and connection strings are encrypted at rest with AES-256-GCM, every call is authenticated with your API key, and live logs show you what happens on every server.",
  },
  {
    q: "What is MCP, exactly?",
    a: "Model Context Protocol — an open standard published by Anthropic in November 2024 that lets AI agents use external tools and data through one interface. An MCP server exposes tools (fetching a web page, querying a database, reading files…); your AI client calls them. TwinMCP is where those servers run.",
  },
  {
    q: "Why not run MCP servers locally?",
    a: "Local stdio works for personal tools but doesn't travel: secrets live in your shell environment, there are no central logs, and every machine needs its own setup. Serving over HTTP fixes that, but then you manage containers, TLS and isolation yourself — which is exactly what TwinMCP does for you.",
  },
];

export const frFaqItems: { q: string; a: string }[] = [
  {
    q: "Combien coûte TwinMCP ?",
    a: `Vous payez à l’usage, sans abonnement. Chaque nouveau compte reçoit ${FR.signupCredit} de crédit offert, sans carte, valable ${FR.signupDays} jours : de quoi faire tourner ${FR.creditServers} serveur avec jusqu’à ${FREE_MCP_LIMIT} MCP plus TwinMCP Docs. Ensuite, vous rechargez un solde prépayé à partir de ${FR.minTopup}. Les appels d’outils coûtent ${FR.per1000Calls} les 1 000 et le calcul ${FR.cpuHour.small} par heure de CPU actif sur un petit serveur.`,
  },
  {
    q: "Connecter mon IDE consomme-t-il mon crédit ?",
    a: "Non. Seuls les appels d’outils sont facturés : les requêtes où votre IA demande réellement à un MCP de faire quelque chose. La connexion, la liste des outils, les pings et l’ouverture de session sont gratuits ; reconnecter un client ou changer d’IDE ne coûte donc rien.",
  },
  {
    q: "Puis-je recevoir une facture surprise ?",
    a: "Non. TwinMCP est prépayé : vous ne pouvez dépenser que le crédit de votre solde. Quand il arrive à zéro, les appels d’outils sont refusés avec un message clair et vos serveurs se mettent en pause. Rien n’est prélevé sur une carte, sauf si vous activez la recharge automatique, plafonnée chaque mois au montant que vous fixez.",
  },
  {
    q: "Que se passe-t-il quand le crédit offert est épuisé ?",
    a: `Rien n’est prélevé : sans carte enregistrée, rien ne peut l’être. Les appels s’arrêtent jusqu’à ce que vous rechargiez, à partir de ${FR.minTopup}, au moment où vous le décidez. Votre première recharge débloque aussi jusqu’à ${FR.fundedServers} serveurs et toutes les tailles de box.`,
  },
  {
    q: "Faut-il Docker ou un VPS ?",
    a: "Non. Vous choisissez un MCP dans le catalogue : TwinMCP l’installe dans votre serveur isolé et vous donne une URL et une clé API. Comptez environ 2 minutes.",
  },
  {
    q: "Puis-je héberger un serveur MCP absent du catalogue ?",
    a: "Oui, une fois votre compte alimenté (après votre première recharge). Publiez n’importe quel serveur MCP distribué en paquet npm ou PyPI, serveurs stdio compris : TwinMCP l’installe dans votre serveur isolé, fait le pont entre stdio et Streamable HTTP et lui donne une URL comme à n’importe quel MCP du catalogue. Il reste privé à votre compte. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner dans le sandbox pour l’instant.",
  },
  {
    q: "Quels clients IA sont compatibles ?",
    a: "Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Cline et Zed, ainsi que tout client compatible Streamable HTTP. Le tableau de bord génère le bloc de configuration exact pour chacun : le même serveur hébergé fonctionne dans tous. Configurez-le une fois, changez d’IDE sans rien réinstaller.",
  },
  {
    q: "Mes secrets sont-ils protégés ?",
    a: "Chaque serveur tourne dans son propre sandbox isolé, une micro-VM Upstash Box. Vos secrets (tokens d’API, chaînes de connexion) sont chiffrés au repos en AES-256-GCM, chaque appel est authentifié par votre clé API, et les logs en direct vous montrent ce qui se passe sur chaque serveur.",
  },
  {
    q: "Qu’est-ce qu’un serveur MCP exactement ?",
    a: "MCP (Model Context Protocol) est un standard ouvert publié par Anthropic en novembre 2024. Il permet à un assistant IA d’utiliser des outils et des données externes via une interface unique. Un serveur MCP expose des outils (lire une page web, interroger une base de données, lire des fichiers…) ; votre client IA les appelle. TwinMCP est l’endroit où ces serveurs tournent.",
  },
  {
    q: "Pourquoi ne pas faire tourner mes serveurs MCP en local ?",
    a: "En local (stdio), un MCP convient à un usage personnel, mais il ne vous suit pas : les secrets restent dans l’environnement shell, il n’y a pas de logs centralisés et chaque machine doit être configurée. Le transport HTTP règle ce problème, mais vous devez alors gérer conteneurs, TLS et isolation. C’est précisément ce que TwinMCP fait pour vous.",
  },
];

const DEFAULTS: Record<Locale, { title: string; description: string; items: FaqItem[] }> = {
  en: {
    title: "Questions that come up before signing up",
    description:
      "If something's missing, send it to hello@twinmcp.fr — answers feed back into this list.",
    items: defaultFaqItems,
  },
  fr: {
    title: "Les questions qu’on se pose avant de s’inscrire",
    description:
      "Une question manque ? Écrivez à hello@twinmcp.fr, la réponse viendra enrichir cette liste.",
    items: frFaqItems,
  },
};

interface FaqProps {
  items?: FaqItem[];
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  /** Picks the default items, title and description. */
  locale?: Locale;
  /** "accordion" (default) collapses answers; "list" prints every answer as an
   *  open ledger, so objections are answered without a click and the answers
   *  are in the HTML that the FAQPage JSON-LD describes. */
  variant?: "accordion" | "list";
}

export function Faq({
  locale = "en",
  items,
  eyebrow = "FAQ",
  title,
  description,
  id = "faq",
  variant = "accordion",
}: FaqProps = {}) {
  const d = DEFAULTS[locale];
  const list = items ?? d.items;
  return (
    <Section
      id={id}
      eyebrow={eyebrow}
      title={title ?? d.title}
      description={description ?? d.description}
      className="scroll-mt-20"
    >
      {variant === "list" ? (
        // The list is a ledger: a hairline above the first question closes the ruling.
        <dl className="mx-auto max-w-3xl divide-y divide-border border-y border-border">
          {list.map((item, i) => (
            <div key={i} className="py-5">
              <dt className="text-lg font-medium">{item.q}</dt>
              <dd className="mt-2 text-base leading-7 text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      ) : (
        // The accordion is a ledger: a hairline above the first question closes the ruling.
        <div className="mx-auto max-w-3xl border-t border-border">
          <Accordion type="single" collapsible className="w-full">
            {list.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent className="leading-relaxed">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </Section>
  );
}
