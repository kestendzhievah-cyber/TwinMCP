import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { marketingOffers } from "@/components/pricing/pricing-data";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: { absolute: "Hébergement de serveurs MCP, sans gérer l'infra — TwinMCP" },
  description:
    "TwinMCP héberge vos serveurs Model Context Protocol dans des runtimes isolés. Installez des MCPs depuis le catalogue, connectez Cursor, Claude Code et Windsurf en 2 minutes. Offre gratuite — sans carte bancaire.",
  alternates: {
    canonical: "/fr",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}/fr`,
    title: "Hébergement de serveurs MCP, sans gérer l'infra — TwinMCP",
    description:
      "Provisionnez des serveurs MCP isolés, installez depuis le catalogue, connectez Cursor / Claude Code / Windsurf en 2 minutes.",
    locale: "fr_FR",
  },
};

const faqFr = [
  {
    q: "Qu'est-ce qu'un serveur MCP exactement ?",
    a: "MCP (Model Context Protocol) est un standard ouvert publié par Anthropic en novembre 2024 qui permet à un assistant IA de communiquer avec des outils et données externes via une interface uniforme. Un serveur MCP expose des capacités (filesystem, GitHub, SQL, n'importe quoi enveloppé dans du JSON-RPC) ; votre client côté IDE (Cursor, Claude Code, Windsurf) les utilise. TwinMCP est le runtime où vivent vos serveurs.",
  },
  {
    q: "Pourquoi ne pas faire tourner mes serveurs MCP localement ?",
    a: "Local stdio fonctionne pour les outils personnels, mais ne survit pas au partage en équipe : les secrets fuient dans l'environnement shell, pas de logs centralisés, redémarrer Cursor tue l'état. Le transport HTTP résout ça mais vous ramène à gérer des conteneurs, du TLS, de l'isolation. C'est exactement ce que TwinMCP gère pour vous.",
  },
  {
    q: "L'offre gratuite est-elle vraiment gratuite ?",
    a: "Oui. Aucune carte bancaire requise. Vous obtenez un serveur isolé, l'accès au catalogue MCP, les logs en direct, et un nombre d'appels d'outils dans des limites raisonnables. La plupart des évaluations personnelles n'ont jamais besoin de passer à un plan supérieur.",
  },
  {
    q: "Quels IDE et clients IA sont compatibles ?",
    a: "Tous ceux qui parlent MCP : Cursor, Claude Desktop, Claude Code, Windsurf, Cline, Continue, Zed. Le même serveur hébergé fonctionne dans tous ces clients avec une seule URL et un seul token — pas de reconfiguration par IDE.",
  },
  {
    q: "Mes secrets sont-ils protégés ?",
    a: "Oui — chaque serveur tourne dans son propre sandbox isolé (Upstash Box, micro-VM Firecracker), avec secrets chiffrés au repos en AES-256-GCM. Votre token GitHub, votre clé Slack, votre chaîne de connexion Postgres ne touchent jamais votre ordinateur.",
  },
  {
    q: "Puis-je auto-héberger TwinMCP ?",
    a: "Pas encore. Le plan de contrôle (Next.js + Postgres) est prêt pour l'open-source mais la couche d'orchestration est actuellement couplée à Upstash Box. L'auto-hébergement est sur la roadmap.",
  },
];

const howToFr = howToSchema({
  name: "Comment lancer un serveur MCP avec TwinMCP",
  description:
    "Provisionnez un serveur Model Context Protocol dans un runtime isolé et connectez-le à Cursor, Claude Code, Windsurf ou Cline.",
  totalTime: "PT2M",
  steps: [
    {
      name: "Créer un compte TwinMCP",
      text: "Inscription gratuite — pas de carte bancaire. Vous obtenez un serveur et l'accès au catalogue MCP.",
      url: "/sign-up",
    },
    {
      name: "Provisionner un serveur",
      text: "Choisissez un runtime (Node.js, Python, Go, Ruby, ou Rust). TwinMCP démarre un sandbox Upstash Box isolé en quelques secondes.",
    },
    {
      name: "Installer des MCPs depuis le catalogue",
      text: "GitHub, Notion, Linear, Postgres, Slack et beaucoup d'autres MCPs s'installent en un clic dans votre serveur.",
    },
    {
      name: "Connecter votre agent IA",
      text: "Copiez l'URL et la clé API depuis le dashboard, collez-les dans Cursor, Claude Code, Windsurf ou Cline.",
      url: "/docs",
    },
  ],
});

const benefits = [
  {
    title: "Mise en place en 2 minutes",
    body: "Choisissez un runtime, installez un MCP depuis le catalogue, collez le snippet généré dans votre IDE. Pas de Docker, pas de TLS, pas de jonglage avec les variables d'environnement.",
  },
  {
    title: "Isolation par serveur",
    body: "Chaque MCP tourne dans son propre sandbox Upstash Box avec secrets chiffrés et clé API dédiée. Un outil défaillant ne peut pas toucher autre chose que lui-même.",
  },
  {
    title: "Marche partout, une seule fois",
    body: "Cursor aujourd'hui, Claude Desktop demain, Windsurf la semaine prochaine. Le même MCP hébergé fonctionne dans tous avec une URL et un token.",
  },
];

const steps = [
  {
    n: 1,
    title: "Créez un compte gratuit",
    body: "Inscription en 30 secondes, sans carte bancaire. Vous obtenez un serveur et l'accès au catalogue MCP.",
  },
  {
    n: 2,
    title: "Provisionnez un serveur",
    body: "Choisissez le runtime (Node, Python, Go, Ruby, Rust). TwinMCP démarre un sandbox Upstash Box isolé en quelques secondes.",
  },
  {
    n: 3,
    title: "Installez des MCPs",
    body: "GitHub, Notion, Linear, Postgres, Slack et d'autres MCPs s'installent en un clic dans votre serveur. Secrets chiffrés au repos.",
  },
  {
    n: 4,
    title: "Connectez votre IDE",
    body: "Copiez le snippet généré dans le dashboard, collez-le dans Cursor, Claude Desktop, Windsurf ou Cline. Les outils apparaissent immédiatement dans le modèle.",
  },
];

const tiers: {
  name: string;
  price: string;
  cadence?: string;
  blurb?: string;
  features: string[];
  highlight: boolean;
}[] = [
  {
    name: "Free",
    price: "€0",
    blurb: "Pour évaluer la plateforme",
    features: ["1 serveur", "5 MCPs officiels", "Support communautaire"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "€14.99",
    cadence: "par mois",
    features: ["25 serveurs", "Publier vos propres MCPs", "Logs d'audit · 30 jours"],
    highlight: true,
  },
  {
    name: "Team",
    price: "€99",
    cadence: "par mois",
    features: ["Serveurs illimités", "Jusqu'à 10 membres", "SLA · 99,9% uptime"],
    highlight: false,
  },
];

// Hero eyebrow sitting between two short hairlines (DESIGN.md §4.7). Like the
// EN hero, the rules are hidden below `sm` so the line never wraps between them
// on phones; section eyebrows go through <Section />.
const HERO_EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:hidden before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:hidden after:h-px after:w-10 after:shrink-0 after:bg-border after:content-[''] sm:before:block sm:after:block";

// Skip rendering off-screen sections until scrolled near — cuts the initial
// layout/paint work on this long page (the Lighthouse forced-reflow / render
// item). A fixed contain-intrinsic-size reserves a stable 640px placeholder per
// section (no CLS on load) and — unlike the `auto` keyword — is honored on every
// browser that supports content-visibility. Unsupported browsers ignore it.
const CV = "[content-visibility:auto] [contain-intrinsic-size:640px]";

export default function FrHomePage() {
  return (
    <>
      <JsonLd
        data={[
          softwareApplicationSchema({
            description:
              "TwinMCP fait tourner les serveurs Model Context Protocol dans des runtimes isolés pour les agents de codage IA (Cursor, Claude Code, Windsurf, Cline).",
            offers: marketingOffers(),
          }),
          faqPageSchema(faqFr),
          howToFr,
        ]}
      />

      {/* Hero — the centre of the card: a dateline eyebrow between two hairlines,
          the name engraved in letterspaced small capitals, a short rule, the lead,
          the two buttons, and one small-caps address line of facts. */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <p className={HERO_EYEBROW_RULES}>Le MCP en tant que service</p>
            <h1 className="display letterpress mt-8 hyphens-auto text-3xl sm:text-5xl md:text-6xl lg:text-7xl">
              Hébergement de serveurs MCP, sans gérer l&apos;infrastructure.
            </h1>
            <div aria-hidden className="mt-8 h-px w-12 bg-foreground/40" />
            <p className="mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
              TwinMCP héberge vos serveurs Model Context Protocol dans des runtimes isolés.
              Installez depuis un catalogue, connectez Cursor, Claude Code et Windsurf en 2 minutes.
              Offre gratuite — sans carte bancaire.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={"/sign-up?plan=free" as Route}>
                  Démarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={"/fr/blog/what-is-mcp" as Route}>Qu&apos;est-ce que MCP ?</Link>
              </Button>
            </div>
            <p className="smallcaps tracking-sc lining mt-8 text-xs text-muted-foreground">
              1 serveur gratuit · 5 MCPs officiels · Sans carte bancaire
            </p>
          </div>
        </div>
      </section>

      {/* Problem / solution */}
      <Section
        bordered
        eyebrow="Le problème"
        title="MCP local sur chaque ordinateur ne passe pas à l'échelle."
        className={CV}
      >
        {/* One sheet of card stock ruled down the middle: today on the left,
            TwinMCP on the right. */}
        <div className="grid divide-y divide-border border border-border bg-card shadow-sm md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 border-b border-foreground/50 pb-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center border border-destructive/40 bg-destructive/10 text-destructive">
                <X className="h-4 w-4" />
              </span>
              <p className="smallcaps tracking-sc text-lg font-medium">Sans TwinMCP</p>
            </div>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Aujourd&apos;hui, la plupart des équipes lancent leurs serveurs MCP comme processus
              enfants stdio sur chaque ordinateur portable de développeur. Ça fonctionne pour les
              outils personnels mais casse dès qu&apos;une équipe veut partager un MCP : les secrets
              fuient dans l&apos;environnement shell, pas de logs centralisés, redémarrer Cursor tue
              tout l&apos;état.
            </p>
          </div>
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 border-b border-foreground/50 pb-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center border border-success/40 bg-success/10 text-success">
                <Check className="h-4 w-4" />
              </span>
              <p className="smallcaps tracking-sc text-lg font-medium">Avec TwinMCP</p>
            </div>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              TwinMCP exécute chaque serveur MCP dans son propre sandbox Upstash Box, avec secrets
              chiffrés au repos et clé API par utilisateur. Le dashboard vous donne un snippet de
              configuration prêt à coller dans Cursor, Claude Desktop, Windsurf ou Cline. Une URL
              stable. Un token. Zero gestion d&apos;infrastructure.
            </p>
          </div>
        </div>
      </Section>

      {/* Benefits */}
      <Section
        id="features"
        bordered
        eyebrow="Fonctionnalités"
        title="Pourquoi les développeurs choisissent TwinMCP"
        className={`scroll-mt-20 ${CV}`}
      >
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="border border-border bg-card p-6 shadow-sm">
              <h3 className="smallcaps tracking-sc text-lg font-medium">{b.title}</h3>
              <p className="mt-2 text-base text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section
        id="how-it-works"
        bordered
        eyebrow="En quatre étapes"
        title="Comment ça marche"
        className={`scroll-mt-20 ${CV}`}
      >
        <ol role="list" className="grid gap-6 md:grid-cols-2">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-col border border-border bg-card p-6 shadow-sm">
              {/* The step number is stamped in a hairline square, lining figures. */}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="lining grid h-9 w-9 shrink-0 place-items-center border border-foreground/60 text-sm font-medium text-foreground"
                >
                  {s.n}
                </span>
                <h3 className="smallcaps tracking-sc text-lg font-medium">{s.title}</h3>
              </div>
              <p className="mt-4 text-base text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Pricing teaser */}
      <Section
        bordered
        eyebrow="Tarifs"
        title="Tarification simple"
        description="Commencez gratuitement. Passez à un plan supérieur seulement quand vous dépassez le quota."
        className={CV}
      >
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "relative flex flex-col border bg-card p-6",
                t.highlight ? "border-foreground/70 shadow-stack" : "border-border shadow-sm"
              )}
            >
              {t.highlight && (
                // The seal straddles the card's top rule; the bg-card wrapper keeps the
                // hairline from showing through the badge's translucent tint.
                <div className="absolute -top-3 left-6 bg-card">
                  <Badge variant="gilt">Le plus populaire</Badge>
                </div>
              )}
              <h3 className="smallcaps tracking-sc text-lg font-medium">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="lining text-4xl font-medium">{t.price}</span>
                {t.cadence && (
                  <span className="text-sm italic text-muted-foreground">{t.cadence}</span>
                )}
              </div>
              {t.blurb && <p className="mt-3 text-sm italic text-muted-foreground">{t.blurb}</p>}
              <ul className="lining mt-6 flex-1 space-y-2.5 border-t border-border pt-5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex justify-center">
          <Link
            href="/plans"
            className="inline-flex items-center gap-1.5 text-sm text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
          >
            Voir toutes les fonctionnalités
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      {/* FAQ */}
      <Section
        id="faq"
        bordered
        eyebrow="FAQ"
        title="Questions fréquentes"
        className={`scroll-mt-20 ${CV}`}
      >
        {/* The list is a ledger: a hairline above the first question closes the ruling. */}
        <dl className="mx-auto max-w-3xl divide-y divide-border border-t border-border">
          {faqFr.map((item, i) => (
            <div key={i} className="py-5">
              <dt className="text-lg font-medium">{item.q}</dt>
              <dd className="mt-2 text-base leading-7 text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Final CTA */}
      <section className={`rule-double py-20 md:py-28 ${CV}`}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl border border-foreground/60 bg-card p-10 text-center md:p-14">
            <h2 className="text-2xl font-medium md:text-3xl">
              Prêt à lancer votre premier serveur MCP en 2 minutes ?
            </h2>
            <p className="mt-3 text-base italic text-muted-foreground">
              Offre gratuite — un serveur, le catalogue MCP, sans carte bancaire.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={"/sign-up?plan=free" as Route}>
                  Démarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={"/fr/blog" as Route}>Lire le blog</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
