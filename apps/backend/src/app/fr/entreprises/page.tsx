import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRight, Check, Boxes, ShieldCheck, Zap } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
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
    body: "GitHub, bases de données, CRM, documentation interne, Slack… Plus de 70 connecteurs, une seule URL, une seule clé. L'IA cesse d'être un chatbot isolé et travaille sur vos vraies données.",
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
    n: 1,
    title: "Choisissez vos connecteurs",
    body: "Depuis le catalogue, installez en un clic les outils que vos équipes utilisent : dépôts de code, bases de données, CRM, gestion de projet, documentation.",
  },
  {
    n: 2,
    title: "Récupérez une URL + une clé",
    body: "Chaque serveur MCP tourne dans son propre sandbox. Vous obtenez un point de connexion sécurisé à coller dans l'assistant IA de vos équipes.",
  },
  {
    n: 3,
    title: "L'IA travaille sur vos données",
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
    a: "Plus de 70 connecteurs : GitHub, GitLab, Postgres, MongoDB, Notion, Slack, HubSpot, Supabase, bases vectorielles, recherche web, et bien d'autres — installables en un clic depuis le catalogue.",
  },
  {
    q: "Faut-il une équipe technique pour démarrer ?",
    a: "Non. Il n'y a aucune infrastructure à gérer : vous installez un connecteur, vous récupérez une URL et une clé, et vous les collez dans votre assistant IA. Le tout en quelques minutes.",
  },
];

// Section eyebrow sitting between two short hairlines (DESIGN.md §4.7); the
// left-aligned variant drops the trailing rule.
const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']";
const EYEBROW_LEFT =
  "eyebrow flex items-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-['']";

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

      {/* Hero — the centred name: eyebrow between rules, engraved title, a short
          rule, the lead, the two buttons, one small-caps address line. */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <p className={EYEBROW_RULES}>Pour les entreprises</p>
            <h1 className="display letterpress mt-8 text-4xl sm:text-5xl md:text-6xl">
              Votre IA, enfin branchée sur vos outils.
            </h1>
            <div aria-hidden className="mt-8 h-px w-12 bg-foreground/40" />
            <p className="mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
              TwinMCP connecte les assistants IA de vos équipes à vos données et applications métier
              — en un clic, sans gérer d'infrastructure, avec la sécurité et la gouvernance qu'exige
              l'entreprise.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={"/sign-up?plan=free" as Route}>
                  Démarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#demo">Demander une démo</a>
              </Button>
            </div>
            <p className="smallcaps tracking-sc lining mt-8 text-xs text-muted-foreground">
              Plus de 70 connecteurs · Clé d'API par utilisateur · Aucune infrastructure à gérer
            </p>
          </div>
        </div>
      </section>

      {/* Problème */}
      <section className="rule-double py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className={EYEBROW_RULES}>Le problème</p>
            <h2 className="mt-4 text-3xl font-medium md:text-4xl">
              Le frein à l'IA en entreprise n'est pas le modèle — c'est son branchement.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Aujourd'hui, l'adoption de l'IA dans les PME plafonne à environ 26 % (l'objectif
              national France 2030 est de 80 % d'ici 2030). La raison est rarement le modèle : c'est
              que l'IA reste coupée du système d'information. Sans accès sécurisé au code, aux bases
              de données, au CRM ou à la documentation, elle reste un assistant de conversation à
              faible valeur — et les connexions bricolées en local ne passent pas à l'échelle
              (secrets qui fuient, aucune gouvernance, aucun audit).
            </p>
          </div>
        </div>
      </section>

      {/* Bénéfices */}
      <Section bordered>
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="border border-border bg-card p-6 shadow-sm">
                {/* Icons sit bare in a hairline square, never in a tinted circle. */}
                <span className="grid h-9 w-9 place-items-center border border-border text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="smallcaps tracking-sc mt-4 text-lg font-medium">{b.title}</h3>
                <p className="mt-2 text-base text-muted-foreground">{b.body}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* France 2030 / aides */}
      <Section bordered>
        {/* A memo on green stock: the success tint with an ink rule in the margin. */}
        <div className="mx-auto max-w-4xl border border-l-2 border-success/40 border-l-success bg-success/10 p-8 md:p-10">
          <p className="smallcaps tracking-sc text-xs font-medium text-success">
            Financement France 2030
          </p>
          <h2 className="mt-3 text-2xl font-medium md:text-3xl">
            Votre adoption de l'IA peut être subventionnée.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Le plan « Osez l'IA » / IA Booster France 2030, opéré par Bpifrance, prend en charge une
            partie du diagnostic Data IA et des missions de conseil pour déployer l'IA dans les PME.
            TwinMCP est la brique concrète que ces accompagnements servent à mettre en place.
            Rapprochez-vous de votre conseiller Bpifrance régional pour cadrer votre éligibilité.
          </p>
          <ul className="lining mt-6 grid gap-2 text-sm md:grid-cols-2">
            {[
              "Diagnostic Data IA partiellement pris en charge par l'État",
              "Missions de conseil au déploiement subventionnées",
              "PME de 10 à 2 000 salariés (CA > 1 M€)",
              "Dispositif ouvert jusqu'à fin 2026",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Comment ça marche */}
      <Section bordered eyebrow="En trois étapes" title="Comment ça marche">
        <ol role="list" className="grid gap-6 md:grid-cols-3">
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

      {/* Demander une démo */}
      <Section id="demo" bordered className="scroll-mt-20">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <p className={EYEBROW_LEFT}>Demander une démo</p>
            <h2 className="mt-4 text-3xl font-medium md:text-4xl">
              Voyons ce que l'IA peut faire sur vos outils.
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              Dites-nous quels outils vous souhaitez connecter. On vous montre une démo sur un cas
              concret et on cadre, si besoin, votre éligibilité aux aides France 2030.
            </p>
            <ul className="lining mt-6 divide-y divide-border border-y border-border text-sm">
              {[
                "15 min, sans engagement",
                "Démo sur vos cas d'usage",
                "Accompagnement sur les financements",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 py-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* The form sits on a plain card, like the EN enterprise page. */}
          <div className="border border-border bg-card p-6 shadow-sm md:p-8">
            <DemoRequestForm />
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section bordered eyebrow="FAQ" title="Questions fréquentes">
        {/* The list is a ledger: a hairline above the first question closes the ruling. */}
        <dl className="mx-auto max-w-3xl divide-y divide-border border-t border-border">
          {faq.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="text-lg font-medium">{item.q}</dt>
              <dd className="mt-2 text-base leading-7 text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* CTA final */}
      <section className="rule-double py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl border border-foreground/60 bg-card p-10 text-center md:p-14">
            <h2 className="text-2xl font-medium md:text-3xl">
              Prêt à brancher l'IA sur vos outils ?
            </h2>
            <p className="mt-3 text-base italic text-muted-foreground">
              Offre gratuite — sans carte bancaire. Ou parlez-en avec un expert pour votre équipe.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={"/sign-up?plan=free" as Route}>
                  Démarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#demo">Demander une démo</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
