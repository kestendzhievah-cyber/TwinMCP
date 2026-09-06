import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRight, Check, Boxes, ShieldCheck, Zap } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";
import { DemoRequestForm } from "./demo-request-form";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Adoption de l'IA en entreprise — connecter l'IA à vos outils | TwinMCP",
  description:
    "TwinMCP branche l'IA de votre entreprise sur vos outils métier (GitHub, bases de données, CRM, documentation) en un clic, de façon sécurisée. Intégration IA pour PME — compatible avec les dispositifs France 2030 / IA Booster.",
  alternates: { canonical: "/fr/entreprises" },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}/fr/entreprises`,
    title: "Adoption de l'IA en entreprise — TwinMCP",
    description:
      "Connectez vos assistants IA à vos outils métier, en un clic et de façon sécurisée. Intégration IA pour PME.",
    locale: "fr_FR",
  },
};

const benefits = [
  {
    icon: Boxes,
    title: "Branchée sur votre SI",
    body: "GitHub, bases de données, CRM, documentation interne, Slack… Plus de 66 connecteurs, une seule URL, une seule clé. L'IA cesse d'être un chatbot isolé et travaille sur vos vraies données.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurisée par conception",
    body: "Secrets chiffrés (AES-256-GCM), clé d'API par utilisateur, journaux d'audit, et un agent local pour les données sensibles qui ne quittent pas votre réseau.",
  },
  {
    icon: Zap,
    title: "Déployée en minutes",
    body: "Runtimes isolés, aucune infrastructure à gérer. Vos équipes connectent Cursor, Claude ou Windsurf à leurs outils sans mobiliser d'équipe ops.",
  },
];

const steps = [
  {
    title: "1 — Choisissez vos connecteurs",
    body: "Depuis le catalogue, installez en un clic les outils que vos équipes utilisent : dépôts de code, bases de données, CRM, gestion de projet, documentation.",
  },
  {
    title: "2 — Récupérez une URL + une clé",
    body: "Chaque serveur MCP tourne dans son propre sandbox. Vous obtenez un point de connexion sécurisé à coller dans l'assistant IA de vos équipes.",
  },
  {
    title: "3 — L'IA travaille sur vos données",
    body: "Vos collaborateurs demandent, l'IA lit et agit sur les bons outils — avec des permissions par utilisateur et une traçabilité complète.",
  },
];

const faq = [
  {
    q: "Peut-on financer l'adoption de l'IA avec des aides de l'État ?",
    a: "Oui. Le plan France 2030 « Osez l'IA » (opéré par Bpifrance) subventionne le diagnostic Data IA et des missions de conseil pour déployer l'IA dans les PME. TwinMCP est précisément le type de solution que ces accompagnements visent à mettre en place. Rapprochez-vous de votre conseiller Bpifrance régional pour cadrer votre éligibilité.",
  },
  {
    q: "Nos données restent-elles confidentielles ?",
    a: "Oui. Les secrets sont chiffrés au repos (AES-256-GCM), chaque utilisateur dispose de sa propre clé d'API, et toutes les actions sont journalisées. Pour les données qui ne doivent pas sortir de votre réseau, un agent local exécute les outils sur vos machines.",
  },
  {
    q: "Quels outils peut-on connecter ?",
    a: "Plus de 66 connecteurs : GitHub, GitLab, Postgres, MongoDB, Notion, Slack, HubSpot, Supabase, bases vectorielles, recherche web, et bien d'autres — installables en un clic depuis le catalogue.",
  },
  {
    q: "Faut-il une équipe technique pour démarrer ?",
    a: "Non. Il n'y a aucune infrastructure à gérer : vous installez un connecteur, vous récupérez une URL et une clé, et vous les collez dans votre assistant IA. Le tout en quelques minutes.",
  },
];

export default function EntreprisesPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Entreprises", url: "/fr/entreprises" },
          ]),
          faqPageSchema(faq),
        ]}
      />

      {/* Hero */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-5xl px-6 py-24 md:py-32">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pour les entreprises
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Votre IA, enfin branchée sur vos outils.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            TwinMCP connecte les assistants IA de vos équipes à vos données et applications métier —
            en un clic, sans gérer d'infrastructure, avec la sécurité et la gouvernance qu'exige
            l'entreprise.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={"/sign-up?plan=free" as Route}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Démarrer gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Demander une démo
            </a>
          </div>
        </div>
      </section>

      {/* Problème */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Le frein à l'IA en entreprise n'est pas le modèle — c'est son branchement.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Aujourd'hui, l'adoption de l'IA dans les PME plafonne à environ 26 % (l'objectif
            national France 2030 est de 80 % d'ici 2030). La raison est rarement le modèle : c'est
            que l'IA reste coupée du système d'information. Sans accès sécurisé au code, aux bases
            de données, au CRM ou à la documentation, elle reste un assistant de conversation à
            faible valeur — et les connexions bricolées en local ne passent pas à l'échelle (secrets
            qui fuient, aucune gouvernance, aucun audit).
          </p>
        </div>
      </section>

      {/* Bénéfices */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="rounded-2xl border border-border bg-card p-6">
                  <Icon className="h-5 w-5 text-foreground" />
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{b.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{b.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* France 2030 / aides */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="rounded-2xl border border-emerald-600/30 bg-emerald-600/[0.04] p-8 md:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Financement France 2030
            </p>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              Votre adoption de l'IA peut être subventionnée.
            </h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
              Le plan « Osez l'IA » / IA Booster France 2030, opéré par Bpifrance, prend en charge
              une partie du diagnostic Data IA et des missions de conseil pour déployer l'IA dans
              les PME. TwinMCP est la brique concrète que ces accompagnements servent à mettre en
              place. Rapprochez-vous de votre conseiller Bpifrance régional pour cadrer votre
              éligibilité.
            </p>
            <ul className="mt-6 grid gap-2 text-sm md:grid-cols-2">
              {[
                "Diagnostic Data IA partiellement pris en charge par l'État",
                "Missions de conseil au déploiement subventionnées",
                "PME de 10 à 2 000 salariés (CA > 1 M€)",
                "Dispositif ouvert jusqu'à fin 2026",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Comment ça marche
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title}>
                <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demander une démo */}
      <section id="demo" className="scroll-mt-20 border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Demander une démo
              </p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Voyons ce que l'IA peut faire sur vos outils.
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Dites-nous quels outils vous souhaitez connecter. On vous montre une démo sur un cas
                concret et on cadre, si besoin, votre éligibilité aux aides France 2030.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {[
                  "15 min, sans engagement",
                  "Démo sur vos cas d'usage",
                  "Accompagnement sur les financements",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <DemoRequestForm />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Questions fréquentes
          </h2>
          <dl className="mt-10 space-y-6">
            {faq.map((item) => (
              <div key={item.q} className="rounded-xl border border-border bg-card p-6">
                <dt className="text-base font-semibold tracking-tight">{item.q}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="rounded-2xl border border-border bg-card p-10 text-center md:p-14">
          <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Prêt à brancher l'IA sur vos outils ?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Offre gratuite — sans carte bancaire. Ou parlez-en avec un expert pour votre équipe.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={"/sign-up?plan=free" as Route}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Démarrer gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Demander une démo
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
