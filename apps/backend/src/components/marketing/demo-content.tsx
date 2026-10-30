import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Faq } from "@/components/marketing/faq";
import { DemoRequestForm, type DemoPack } from "@/components/marketing/demo-request-form";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { MCP_BUNDLES } from "@/lib/mcp-bundles";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { solutionForBundle } from "@/lib/solutions/data";
import type { Locale } from "@/lib/i18n/locales";
import type { DemoTopic } from "@/lib/sales/demo-request";

// The guided-setup page (EN /demo, FR /fr/demo; contract K3). The page files
// only add metadata, JSON-LD and server-side page tracking.
//
// Facts policy — every sentence maps to code:
//   - what an admin can set up for a client: the admin console
//     (app/api/v2/admin/clients/[id]/servers/**, one-click packs from
//     lib/mcp-bundles.ts); every admin action is logged on the CLIENT's audit
//     log (logAudit({ userId: clientId, … }) in those routes), shown for
//     PLAN_CAPABILITIES.pro.auditRetentionDays once funded (dashboard/audit-logs);
//   - API keys are created by the account owner only (no admin route mints
//     keys), shown once, stored as a SHA-256 hash (lib/auth.ts hashKey);
//   - MCP config secrets are AES-256-GCM encrypted (lib/crypto/config-encryption.ts);
//   - account facts: lib/plan-features.ts; prices: lib/wallet/pricing.ts via
//     components/pricing/wallet-copy.ts (prepaid wallet, no subscription).
// The setup fee has NO number on purpose: it is quoted after the call.
// No SLA, no response-time promise, no region choice, no team sharing.

const free = PLAN_CAPABILITIES.free;
const pro = PLAN_CAPABILITIES.pro;
const EN = walletFacts("en");
const FR = walletFacts("fr");

/** English names of the admin packs come from the solution pages
 *  (lib/solutions/data.ts), so a pack keeps one name across the funnel;
 *  lib/mcp-bundles.ts labels are French. */
function bundleLabel(id: string, label: string, locale: Locale): string {
  return locale === "fr" ? label : (solutionForBundle(id)?.en.name ?? label);
}

const SIGN_UP = { en: "/sign-up", fr: "/fr/inscription" } as const;
const SECURITY = { en: "/security", fr: "/fr/securite" } as const;

// ─── Copy ────────────────────────────────────────────────────────────────────

function copy(locale: Locale) {
  if (locale === "fr") {
    return {
      hero: {
        eyebrow: "Installation accompagnée",
        title: "Nous installons vos serveurs MCP pour vous.",
        lead: "Pour les équipes qui préfèrent ne pas tout câbler elles-mêmes : nous créons votre serveur TwinMCP, installons les MCP dont vous avez besoin et les connectons à votre client IA avec vous. Les mêmes serveurs hébergés qu’en libre-service, sur votre propre compte.",
        primary: "Demander une installation",
        secondary: `Démarrer seul avec ${FR.signupCredit} offerts`,
      },
      setup: {
        eyebrow: "Ce que nous installons",
        title: "Quatre choses, prêtes à servir",
        items: [
          {
            name: "Votre serveur",
            body: `Un serveur TwinMCP sur votre compte, dans sa propre Upstash Box isolée. Taille small avec le crédit offert ; small, medium ou large une fois le compte alimenté, selon ce qu’il fait tourner.`,
          },
          {
            name: "Un pack de MCP",
            body: "Nous partons d’un des packs ci-dessous et l’ajustons : n’importe quel MCP du catalogue et, une fois le compte alimenté, votre propre serveur stdio publié sur npm ou PyPI, qui reste privé à votre compte.",
          },
          {
            name: "Vos clés API",
            body: "Vous créez vos clés pendant la remise en main : une clé n’est affichée qu’une fois, à vous seul, et n’est stockée que sous forme d’empreinte. Nous vous montrons comment limiter une clé au seul proxy MCP d’un serveur.",
          },
          {
            name: "La connexion à votre client IA",
            body: "Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline ou Zed : nous collons avec vous la configuration générée par le tableau de bord, puis lançons un test de connexion.",
          },
        ],
        packsTitle: "Les packs de départ",
        packsNote:
          "Un MCP qui demande vos identifiants (token d’API, chaîne de connexion) est configuré quand vous les avez sous la main ; ils sont chiffrés au repos en AES-256-GCM.",
      },
      how: {
        eyebrow: "Déroulé",
        title: "Un appel, l’installation, la remise en main",
        steps: [
          {
            name: "L’appel",
            body: "Ce que votre client IA doit faire, les outils et les données dont il a besoin, qui l’utilisera. Vous créez ensuite votre compte TwinMCP (le crédit offert suffit pour commencer).",
          },
          {
            name: "L’installation",
            body: `Nous créons le serveur et installons les MCP sur votre compte depuis notre console d’administration. Chaque action est inscrite dans votre journal d’audit (visible ${pro.auditRetentionDays} jours une fois le compte alimenté).`,
          },
          {
            name: "La remise en main",
            body: "Ensemble, nous créons vos clés, connectons votre client IA et lançons un premier appel d’outil. Tout reste modifiable depuis votre tableau de bord.",
          },
        ],
      },
      cost: {
        eyebrow: "Prix",
        title: "Votre usage, prépayé + des frais d’installation uniques, chiffrés après l’appel",
        body: `Sans abonnement : votre compte paie à l’usage depuis un solde prépayé, rechargé à partir de ${FR.minTopup}. Les appels d’outils coûtent ${FR.per1000Calls} les 1 000 et le calcul ${FR.cpuHour.small} par heure de CPU actif sur un petit serveur. Un compte alimenté a droit à ${pro.servers} serveurs, toutes les tailles de box et ${pro.apiKeys} clés API. Les frais d’installation dépendent de ce qu’il y a à connecter : nous vous les indiquons après l’appel.`,
        freeNote: `Pour un seul serveur, le crédit offert peut suffire au départ : ${FR.signupCredit} à l’inscription, valables ${FR.signupDays} jours, ${free.servers} petit serveur, ${free.apiKeys} clés API.`,
      },
      form: {
        eyebrow: "Votre demande",
        title: "Parlez-nous de votre projet",
        security: "Avant d’écrire, la page sécurité détaille ce que nous protégeons et comment.",
        securityLink: "Sécurité & RGPD",
      },
      faq: {
        eyebrow: "FAQ",
        title: "Questions fréquentes sur l’installation accompagnée",
        description: "Une autre question ? Posez-la dans le formulaire ci-dessus.",
      },
    };
  }
  return {
    hero: {
      eyebrow: "Guided setup",
      title: "We set up your MCP servers for you.",
      lead: "For teams that would rather not wire it all themselves: we create your TwinMCP server, install the MCPs you need and connect them to your AI client with you. The same hosted servers as self-serve, on your own account.",
      primary: "Request a guided setup",
      secondary: `Start on your own with ${EN.signupCredit} free`,
    },
    setup: {
      eyebrow: "What we set up",
      title: "Four things, ready to use",
      items: [
        {
          name: "Your server",
          body: `A TwinMCP server on your account, in its own isolated Upstash Box. Small on the free credit; small, medium or large once your account is funded, sized for what it runs.`,
        },
        {
          name: "A pack of MCPs",
          body: "We start from one of the packs below and adjust it: any MCP from the catalogue and, once your account is funded, your own stdio server published on npm or PyPI, which stays private to your account.",
        },
        {
          name: "Your API keys",
          body: "You create your keys during the handover: a key is shown once, only to you, and stored only as a hash. We show you how to restrict a key to the MCP proxy of a single server.",
        },
        {
          name: "The connection in your AI client",
          body: "Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline or Zed: we paste the config the dashboard generates with you, then run a connection test.",
        },
      ],
      packsTitle: "Starting packs",
      packsNote:
        "An MCP that needs your credentials (an API token, a connection string) is configured once you have them at hand; they are encrypted at rest with AES-256-GCM.",
    },
    how: {
      eyebrow: "How it works",
      title: "A call, the setup, the handover",
      steps: [
        {
          name: "The call",
          body: "What your AI client should do, which tools and data it needs, who will use it. You then create your TwinMCP account (the free credit is enough to start).",
        },
        {
          name: "The setup",
          body: `We create the server and install the MCPs on your account from our admin console. Every action is written to your audit log (visible for ${pro.auditRetentionDays} days once your account is funded).`,
        },
        {
          name: "The handover",
          body: "Together we create your keys, connect your AI client and run a first tool call. Everything stays editable from your dashboard.",
        },
      ],
    },
    cost: {
      eyebrow: "Cost",
      title: "Prepaid usage + a one-time setup fee quoted after the call",
      body: `No subscription: your account pays as it goes from a prepaid balance, topped up from ${EN.minTopup}. Tool calls cost ${EN.per1000Calls} per 1,000 and compute ${EN.cpuHour.small} per active CPU-hour on a small server. A funded account gets ${pro.servers} servers, every box size and ${pro.apiKeys} API keys. The setup fee depends on what there is to connect: we quote it after the call.`,
      freeNote: `For a single server, the free credit may be enough to start: ${EN.signupCredit} at sign-up, valid ${EN.signupDays} days, ${free.servers} small server, ${free.apiKeys} API keys.`,
    },
    form: {
      eyebrow: "Your request",
      title: "Tell us about your project",
      security: "Before you write, the security page details what we protect and how.",
      securityLink: "Security & GDPR",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions about the guided setup",
      description: "Another question? Ask it in the form above.",
    },
  };
}

/** Plain-text FAQ, shared by the page and its FAQPage JSON-LD. */
export const DEMO_FAQ: Record<Locale, { q: string; a: string }[]> = {
  en: [
    {
      q: "Do we have to give you our passwords?",
      a: "No. Your TwinMCP account stays yours: we work on your servers from our admin console and every action we take is written to your audit log. Credentials for third-party tools go into the MCP's encrypted config, and you can type them in yourself from the dashboard.",
    },
    {
      q: "Which tools can you connect?",
      a: "Any MCP from the TwinMCP catalogue and, once your account is funded, any MCP server published as an npm or PyPI package, including servers that only speak stdio: each server runs in its own isolated box and your AI client reaches it over Streamable HTTP. Servers shipped only as a Docker image cannot run today.",
    },
    {
      q: "Can we take it over afterwards?",
      a: "Yes. Everything is created on your account and stays editable from your dashboard: add or remove MCPs, rotate keys, pause a server. Nothing in the setup depends on us once it is handed over.",
    },
    {
      q: "What does it cost?",
      a: `Your usage, paid from a prepaid balance (top-ups from ${EN.minTopup}, tool calls ${EN.per1000Calls} per 1,000, compute from ${EN.cpuHour.small} per active CPU-hour, no subscription), plus a one-time setup fee that we quote after the call, once we know what there is to connect.`,
    },
  ],
  fr: [
    {
      q: "Faut-il vous donner nos mots de passe ?",
      a: "Non. Votre compte TwinMCP reste le vôtre : nous intervenons sur vos serveurs depuis notre console d’administration et chacune de nos actions est inscrite dans votre journal d’audit. Les identifiants des outils tiers vont dans la configuration chiffrée du MCP, et vous pouvez les saisir vous-même depuis le tableau de bord.",
    },
    {
      q: "Quels outils pouvez-vous connecter ?",
      a: "N’importe quel MCP du catalogue TwinMCP et, une fois le compte alimenté, tout serveur MCP publié en paquet npm ou PyPI, y compris ceux qui ne parlent que stdio : chaque serveur tourne dans sa propre box isolée et votre client IA l’atteint en Streamable HTTP. Les serveurs distribués uniquement en image Docker ne peuvent pas tourner aujourd’hui.",
    },
    {
      q: "Pourrons-nous reprendre la main ensuite ?",
      a: "Oui. Tout est créé sur votre compte et reste modifiable depuis votre tableau de bord : ajouter ou retirer des MCP, faire tourner les clés, mettre un serveur en pause. Une fois la remise en main faite, rien ne dépend plus de nous.",
    },
    {
      q: "Combien ça coûte ?",
      a: `Votre usage, payé depuis un solde prépayé (recharges dès ${FR.minTopup}, appels d’outils ${FR.per1000Calls} les 1 000, calcul dès ${FR.cpuHour.small} par heure de CPU actif, sans abonnement), plus des frais d’installation uniques, chiffrés après l’appel, une fois connu ce qu’il y a à connecter.`,
    },
  ],
};

// ─── Sections ────────────────────────────────────────────────────────────────

const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']";
const LINK =
  "text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand";

function Numeral({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="lining grid h-9 w-9 shrink-0 place-items-center border border-foreground/60 text-base font-medium"
    >
      {n}
    </span>
  );
}

export function DemoContent({
  locale = "en",
  initialTopic = "setup",
  initialPack,
}: {
  locale?: Locale;
  initialTopic?: DemoTopic;
  initialPack?: DemoPack;
}) {
  const t = copy(locale);
  return (
    <>
      {/* The centred name: eyebrow, engraved H1, hairline, lead, CTAs. */}
      <section className="w-full py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className={EYEBROW_RULES}>{t.hero.eyebrow}</p>
          <h1 className="display letterpress mx-auto mt-6 max-w-4xl text-balance text-4xl md:text-5xl lg:text-6xl">
            {t.hero.title}
          </h1>
          <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t.hero.lead}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full max-w-xs sm:w-auto sm:max-w-none">
              <a href="#request" data-cta-location="demo_hero">
                {t.hero.primary}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href={SIGN_UP[locale] as Route} data-cta-location="demo_hero_self_serve">
                {t.hero.secondary}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Section bordered eyebrow={t.setup.eyebrow} title={t.setup.title}>
        <ol className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {t.setup.items.map((item, i) => (
            <li key={item.name} className="flex gap-4 border border-border bg-card p-6">
              <Numeral n={i + 1} />
              <div>
                <h3 className="smallcaps tracking-sc text-lg font-medium">{item.name}</h3>
                <p className="mt-2 text-base text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-14 max-w-5xl">
          <h3 className="smallcaps tracking-sc border-b border-foreground/50 pb-3 text-lg font-medium">
            {t.setup.packsTitle}
          </h3>
          <dl className="divide-y divide-border border-b border-border">
            {MCP_BUNDLES.map((b) => (
              <div
                key={b.id}
                className="grid gap-1 py-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-8"
              >
                <dt className="smallcaps tracking-sc text-base font-medium">
                  {bundleLabel(b.id, b.label, locale)}
                </dt>
                <dd className="flex flex-wrap gap-2">
                  {b.slugs.map((s) => (
                    <code
                      key={s}
                      className="border border-border bg-background px-2 py-0.5 font-mono text-sm text-muted-foreground"
                    >
                      {s}
                    </code>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm italic text-muted-foreground">{t.setup.packsNote}</p>
        </div>
      </Section>

      <Section bordered eyebrow={t.how.eyebrow} title={t.how.title}>
        <ol className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {t.how.steps.map((step, i) => (
            <li key={step.name} className="border-t border-foreground/60 pt-5">
              <div className="flex items-center gap-3">
                <Numeral n={i + 1} />
                <h3 className="smallcaps tracking-sc text-lg font-medium">{step.name}</h3>
              </div>
              <p className="mt-3 text-base text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section bordered eyebrow={t.cost.eyebrow}>
        <div className="mx-auto max-w-3xl border border-foreground/60 bg-card px-6 py-10 text-center sm:px-10">
          <h2 className="text-balance text-2xl font-medium md:text-3xl">{t.cost.title}</h2>
          <div className="mx-auto mt-5 h-px w-12 bg-foreground/40" />
          <p className="lining mt-5 text-base text-muted-foreground">{t.cost.body}</p>
          <p className="lining mt-4 text-sm italic text-muted-foreground">{t.cost.freeNote}</p>
        </div>
      </Section>

      <Section
        bordered
        id="request"
        eyebrow={t.form.eyebrow}
        title={t.form.title}
        className="scroll-mt-16"
      >
        <div>
          <DemoRequestForm locale={locale} initialTopic={initialTopic} initialPack={initialPack} />
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            {t.form.security}{" "}
            <Link href={SECURITY[locale] as Route} className={LINK}>
              {t.form.securityLink}
            </Link>
          </p>
        </div>
      </Section>

      <div className="rule-double">
        <Faq
          locale={locale}
          items={DEMO_FAQ[locale]}
          eyebrow={t.faq.eyebrow}
          title={t.faq.title}
          description={t.faq.description}
          id="demo-faq"
          variant="list"
        />
      </div>
    </>
  );
}
