import Link from "next/link";
import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { PricingExperience } from "@/components/pricing/pricing-experience";
import { TrustSignals } from "@/components/pricing/trust-signals";
import { ComparisonTable } from "@/components/pricing/comparison-table";
import { FREE_MCP_LIMIT, PLANS, planCopy } from "@/components/pricing/pricing-data";
import { TrackOnMount } from "@/components/analytics/track-event";
import { JsonLd } from "@/components/seo/json-ld";
import { productPricingSchema, faqPageSchema, breadcrumbListSchema } from "@/lib/seo/schema";
import { trackPageServed } from "@/lib/analytics/server";
import { PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";

// French twin of /plans. Same facts (pricing-data.ts, plan-features.ts,
// rate-limit.ts), same components with locale="fr" (the comparison ledger
// included: its French rows live in components/pricing/comparison-table.tsx).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = "/fr/tarifs";

const proMonthly = PLANS.find((p) => p.id === "pro")?.monthlyUsd ?? 14.99;
const proMonthlyFr = proMonthly.toFixed(2).replace(".", ",");
const proYearly = PLANS.find((p) => p.id === "pro")?.annualTotalEur ?? 135;
const frInt = (n: number) => n.toLocaleString("fr-FR");
const FREE_CALLS = frInt(getDailyLimit("free"));
const PRO_CALLS = frInt(getDailyLimit("pro"));

const DESCRIPTION = `Offre gratuite pour toujours (1 serveur, jusqu’à ${FREE_MCP_LIMIT} MCP + TwinMCP Docs, sans carte bancaire). Pro à ${proMonthlyFr} €/mois : 50 serveurs, toutes les tailles de box, ${PRO_CALLS} appels d’outils par jour. Premier mois offert sur un premier abonnement.`;

export const metadata: Metadata = {
  title: "Tarifs",
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: { en: "/plans", fr: PATH, "x-default": "/plans" },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: "Tarifs TwinMCP — commencez gratuitement, passez à Pro quand vous en avez besoin",
    description:
      "Comparez Free et Pro : serveurs, tailles de box, appels d’outils par jour, journaux d’audit, support.",
    locale: "fr_FR",
  },
};

const pricingFaqFr: FaqItem[] = [
  {
    q: "Comment fonctionne le mois offert de Pro ?",
    a: `Votre premier abonnement Pro commence par ${PRO_TRIAL_DAYS} jours offerts. Vous saisissez une carte au moment du paiement, mais rien n’est prélevé pendant l’essai ; résiliez avant la fin et vous ne payez rien. Sinon, Pro se renouvelle à ${proMonthlyFr} € par mois (ou au tarif annuel choisi). Le mois offert s’applique une seule fois par client ; un lien promo de créateur le remplace par sa propre offre.`,
  },
  {
    q: "Comment fonctionne la facturation annuelle ?",
    a: "Vous payez 12 mois d’avance et économisez jusqu’à 25 % par rapport au mensuel. Sur un premier abonnement, le premier mois est offert et l’année est prélevée à sa fin. En cas de résiliation, l’offre court jusqu’à la fin de la période déjà payée ; aucun remboursement au prorata.",
  },
  {
    q: "Puis-je changer d’offre plus tard ?",
    a: "À tout moment, depuis /dashboard/billing. Le passage à Pro prend effet dès que le paiement est validé. La résiliation de Pro prend effet à la fin de la période en cours : vous gardez ce que vous avez payé jusque-là, puis votre compte revient à Free.",
  },
  {
    q: "Qu’est-ce qui compte dans le quota journalier ?",
    a: "Uniquement les appels d’outils : les requêtes où votre IA demande réellement à un MCP de faire quelque chose. La connexion, la liste des outils, les pings et l’ouverture de session sont gratuits ; reconnecter un client ou changer d’IDE n’entame donc jamais votre quota.",
  },
  {
    q: "Que se passe-t-il si je dépasse mon quota ?",
    a: `Les quotas sont des plafonds souples : vos serveurs existants continuent de tourner, mais la création de nouveaux serveurs (et l’installation de MCP au-delà de la limite) est bloquée jusqu’au passage à l’offre supérieure. Les appels d’outils au-delà du quota journalier (${FREE_CALLS} sur Free, ${PRO_CALLS} sur Pro) sont refusés jusqu’à la réinitialisation de la fenêtre de 24 heures. Nous ne facturons jamais automatiquement un dépassement.`,
  },
  {
    q: "L’usage peut-il me coûter plus que le prix de l’offre ?",
    a: `Non. Le prix est fixe : 0 € sur Free, ${proMonthlyFr} € par mois ou ${proYearly} € par an sur Pro. Aucun appel n’est facturé à l’unité et il n’y a pas de dépassement payant : au plafond journalier, les appels sont suspendus jusqu’à la réinitialisation de la fenêtre, sans aucun frais.`,
  },
  {
    q: "Proposez-vous des réductions ?",
    a: "50 % de réduction pour les associations, les étudiants et les mainteneurs actifs de MCP open source publics, sur justificatif. Écrivez à hello@twinmcp.fr.",
  },
  {
    q: "Que deviennent mes données si je résilie ?",
    a: "Quand Pro prend fin, votre compte revient à Free. Votre plus ancien petit serveur continue de tourner ; les autres serveurs (et toute box medium ou large) sont arrêtés : leur environnement d’exécution est supprimé et les fichiers écrits à l’intérieur ne sont pas conservés, mais les serveurs eux-mêmes, leurs MCP installés et leurs réglages, votre compte et vos clés API restent, et un nouvel abonnement vous permet de les redémarrer. Les journaux d’audit ne s’affichent que sur Pro.",
  },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TarifsPage({ searchParams }: { searchParams: SearchParams }) {
  trackPageServed({
    path: PATH,
    locale: "fr",
    searchParams: await searchParams,
    headers: await headers(),
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Tarifs", url: PATH },
          ]),
          productPricingSchema({
            name: "TwinMCP",
            description:
              "Runtimes Model Context Protocol hébergés pour les agents de codage IA — offres Free et Pro.",
            tiers: PLANS.map((p) => ({
              id: p.id,
              name: p.name,
              description: planCopy(p, "fr").blurb,
              priceMonthlyUsd: p.monthlyUsd,
              priceAnnualMonthlyUsd: p.annualMonthlyUsd,
              url: `${PATH}#${p.id}`,
            })),
          }),
          faqPageSchema(pricingFaqFr.map((f) => ({ q: f.q, a: f.a as string }))),
        ]}
      />
      <TrackOnMount name="pricing_view" />

      <Section
        eyebrow="Tarifs"
        title="Payez ce qui tourne, pas ce qui pourrait tourner"
        description="L’offre gratuite est réelle : sans limite de durée, sans carte. Passez à Pro seulement quand le quota ne suffit plus."
      >
        <PricingExperience locale="fr" />
        <div className="mx-auto mt-12 max-w-3xl border-y border-border py-4">
          <TrustSignals locale="fr" />
        </div>
      </Section>

      <Section
        bordered
        eyebrow="Comparer les offres"
        title="Toutes les fonctionnalités, côte à côte"
        description="Pas d’astérisque, pas de pop-up de vente. Ce que vous voyez est ce qui tourne dans le runtime."
      >
        <ComparisonTable locale="fr" />
      </Section>

      <Faq
        locale="fr"
        items={pricingFaqFr}
        eyebrow="FAQ tarifs"
        title="Vos questions sur les tarifs"
        description="Si une réponse manque, écrivez à hello@twinmcp.fr : nous lisons tout."
        id="faq-tarifs"
      />

      <Section bordered>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 border border-border bg-card px-6 py-12 text-center shadow-sm md:px-12 md:py-14">
          <h2 className="text-balance text-3xl font-medium md:text-4xl">
            Le contexte de votre agent, là où il tourne.
          </h2>
          <div className="h-px w-12 bg-foreground/40" />
          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            Commencez gratuitement. Passez à Pro quand (et seulement quand) il se rentabilise.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/fr/inscription?plan=free" as Route} data-cta-location="tarifs_final">
                Commencer gratuitement · sans carte
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={"/fr/docs" as Route}>Lire la documentation</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
