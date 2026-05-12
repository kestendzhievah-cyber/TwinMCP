import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

export const metadata: Metadata = {
  title: "TwinMCP — Hébergement de serveurs MCP sans gérer l'infrastructure",
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
    title: "TwinMCP — Hébergement de serveurs MCP sans gérer l'infrastructure",
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

export default function FrHomePage() {
  return (
    <>
      <JsonLd
        data={[
          softwareApplicationSchema({
            description:
              "TwinMCP fait tourner les serveurs Model Context Protocol dans des runtimes isolés pour les agents de codage IA (Cursor, Claude Code, Windsurf, Cline).",
            offers: [
              { name: "Free", price: "0", url: "/plans" },
              { name: "Pro", price: "20", url: "/plans" },
              { name: "Team", price: "50", url: "/plans" },
            ],
          }),
          faqPageSchema(faqFr),
          howToFr,
        ]}
      />

      {/* Hero */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-5xl px-6 py-24 md:py-32">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            MCPs as a Service
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Hébergement de serveurs MCP, sans gérer l&apos;infrastructure.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            TwinMCP héberge vos serveurs Model Context Protocol dans des runtimes isolés. Installez
            depuis un catalogue, connectez Cursor, Claude Code et Windsurf en 2 minutes. Offre
            gratuite — sans carte bancaire.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={"/sign-up?plan=free" as Route}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Démarrer gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={"/fr/blog/what-is-mcp" as Route}
              className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Qu&apos;est-ce que MCP ?
            </Link>
          </div>
        </div>
      </section>

      {/* Problem / solution */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Le problème : MCP local sur chaque ordinateur ne passe pas à l&apos;échelle.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Aujourd&apos;hui, la plupart des équipes lancent leurs serveurs MCP comme processus
            enfants stdio sur chaque ordinateur portable de développeur. Ça fonctionne pour les
            outils personnels mais casse dès qu&apos;une équipe veut partager un MCP : les secrets
            fuient dans l&apos;environnement shell, pas de logs centralisés, redémarrer Cursor tue
            tout l&apos;état.
          </p>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            TwinMCP exécute chaque serveur MCP dans son propre sandbox Upstash Box, avec secrets
            chiffrés au repos et clé API par utilisateur. Le dashboard vous donne un snippet de
            configuration prêt à coller dans Cursor, Claude Desktop, Windsurf ou Cline. Une URL
            stable. Un token. Zero gestion d&apos;infrastructure.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-center text-3xl font-semibold tracking-tight md:text-4xl">
            Pourquoi les développeurs choisissent TwinMCP
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold tracking-tight">{b.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Comment ça marche
          </h2>
          <ol className="mt-12 space-y-8">
            <li className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold">
                1
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Créez un compte gratuit</h3>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Inscription en 30 secondes, sans carte bancaire. Vous obtenez un serveur et
                  l&apos;accès au catalogue MCP.
                </p>
              </div>
            </li>
            <li className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold">
                2
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Provisionnez un serveur</h3>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Choisissez le runtime (Node, Python, Go, Ruby, Rust). TwinMCP démarre un sandbox
                  Upstash Box isolé en quelques secondes.
                </p>
              </div>
            </li>
            <li className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold">
                3
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Installez des MCPs</h3>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  GitHub, Notion, Linear, Postgres, Slack et d&apos;autres MCPs s&apos;installent en
                  un clic dans votre serveur. Secrets chiffrés au repos.
                </p>
              </div>
            </li>
            <li className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold">
                4
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Connectez votre IDE</h3>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Copiez le snippet généré dans le dashboard, collez-le dans Cursor, Claude Desktop,
                  Windsurf ou Cline. Les outils apparaissent immédiatement dans le modèle.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-center text-3xl font-semibold tracking-tight md:text-4xl">
            Tarification simple
          </h2>
          <p className="mt-4 text-center text-base text-muted-foreground md:text-lg">
            Commencez gratuitement. Passez à un plan supérieur seulement quand vous dépassez le
            quota.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-xl font-semibold">Free</h3>
              <p className="mt-2 text-3xl font-bold">0 $</p>
              <p className="mt-1 text-sm text-muted-foreground">Pour évaluer la plateforme</p>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>1 serveur</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>5 MCPs officiels</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>Support communautaire</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-foreground bg-card p-6">
              <h3 className="text-xl font-semibold">Pro</h3>
              <p className="mt-2 text-3xl font-bold">20 $</p>
              <p className="mt-1 text-sm text-muted-foreground">par mois</p>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>25 serveurs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>Publier vos propres MCPs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>Logs d&apos;audit · 30 jours</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-xl font-semibold">Team</h3>
              <p className="mt-2 text-3xl font-bold">50 $</p>
              <p className="mt-1 text-sm text-muted-foreground">par mois</p>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>Serveurs illimités</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>Jusqu&apos;à 10 membres</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>SLA · 99,9% uptime</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-foreground"
            >
              Voir toutes les fonctionnalités →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-center text-3xl font-semibold tracking-tight md:text-4xl">
            Questions fréquentes
          </h2>
          <dl className="mt-12 space-y-6">
            {faqFr.map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <dt className="text-base font-semibold tracking-tight">{item.q}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="rounded-2xl border border-border bg-card p-10 text-center md:p-14">
          <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Prêt à lancer votre premier serveur MCP en 2 minutes ?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Offre gratuite — un serveur, le catalogue MCP, sans carte bancaire.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={"/sign-up?plan=free" as Route}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Démarrer gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={"/fr/blog" as Route}
              className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Lire le blog
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
