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
import { TrackOnMount } from "@/components/analytics/track-event";
import { JsonLd } from "@/components/seo/json-ld";
import { faqPageSchema, breadcrumbListSchema } from "@/lib/seo/schema";
import { trackPageServed } from "@/lib/analytics/server";
import {
  FUNDED_UNLOCKS,
  SIGNUP_OFFER,
  walletFacts,
  walletProductSchema,
} from "@/components/pricing/wallet-copy";

// French twin of /plans. Same facts (lib/wallet/pricing.ts through
// components/pricing/wallet-copy.ts, lib/plan-features.ts), same components
// with locale="fr".

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = "/fr/tarifs";
const W = walletFacts("fr");

const DESCRIPTION = `Paiement à l’usage, sans abonnement. ${W.signupCredit} de crédit offert à l’inscription, sans carte. Appels d’outils ${W.per1000Calls} les 1 000, calcul dès ${W.cpuHour.small} par heure de CPU actif. Arrêt à zéro : aucune facture surprise.`;

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
    title: `Tarifs TwinMCP — paiement à l’usage, ${W.signupCredit} offerts pour commencer`,
    description: `Un solde prépayé, sans abonnement. ${W.signupCredit} de crédit offert à l’inscription, recharges dès ${W.minTopup}, et les appels s’arrêtent à zéro.`,
    locale: "fr_FR",
  },
};

const pricingFaqFr: FaqItem[] = [
  {
    q: `Comment fonctionne le crédit d’inscription de ${W.signupCredit} ?`,
    a: `Chaque nouveau compte reçoit ${W.signupCredit} de crédit promotionnel, sans carte bancaire. Il est valable ${W.signupDays} jours à compter de l’inscription, un par personne, et il est consommé avant tout crédit acheté. Il fait tourner ${W.creditServers} petit serveur avec les MCP du catalogue, sauf ceux qui exécutent des commandes shell, du code ou un navigateur headless : ils attendent votre première recharge. Le crédit promotionnel non utilisé expire au bout des ${W.signupDays} jours ; il n’a aucune valeur monétaire.`,
  },
  {
    q: "Qu’est-ce qui est facturé exactement ?",
    a: `Deux choses. Les appels d’outils qui atteignent votre serveur MCP coûtent ${W.per1000Calls} les 1 000, erreurs d’outil comprises. Le calcul correspond au temps CPU actif utilisé par votre serveur, tel que la box le mesure : ${W.cpuHour.small} par heure CPU sur un serveur small ; ${W.largerSizes}. La connexion d’un client, la liste des outils et les pings ne sont pas facturés comme appels d’outils, mais le temps CPU qu’ils utilisent fait partie du calcul ; les appels refusés par TwinMCP ne sont pas facturés. Un serveur en pause ne consomme pas de temps CPU, un serveur éveillé mais inactif très peu, et les serveurs se mettent en pause d’eux-mêmes après une période sans activité.`,
  },
  {
    q: "Que se passe-t-il quand mon solde arrive à zéro ?",
    a: `Les appels d’outils sont refusés avec une erreur HTTP 402 et un message clair qui renvoie vers la page de facturation, et vos serveurs se mettent en pause. Rien n’est prélevé sur une carte, sauf si vous avez activé la recharge automatique : pas de facture surprise. Le calcul déjà en cours au moment du passage à zéro peut faire descendre le solde légèrement sous zéro (${W.overdraft} au plus) ; ce montant est déduit de votre prochaine recharge. Rechargez et vous pouvez relancer vos serveurs.`,
  },
  {
    q: "Comment fonctionnent les recharges ?",
    a: `Depuis la page de facturation, choisissez ${W.presets.join(", ")} ou tout montant entre ${W.minTopup} et ${W.maxTopup}, et payez par carte via Stripe. La TVA est calculée au paiement quand elle s’applique. ${FUNDED_UNLOCKS.fr}`,
  },
  {
    q: "Qu’est-ce que la recharge automatique ?",
    a: "Une option, désactivée par défaut. Quand votre solde passe sous un seuil que vous choisissez, TwinMCP le recharge du montant choisi, sur la carte enregistrée, dans la limite d’un plafond mensuel que vous fixez. Vous pouvez la modifier ou la couper à tout moment depuis la page de facturation.",
  },
  {
    q: "Le crédit expire-t-il ?",
    a: `Le crédit d’inscription expire ${W.signupDays} jours après l’inscription. Le crédit que vous avez payé n’a pas de date d’expiration : il reste disponible tant que votre compte est ouvert.`,
  },
  {
    q: "Y a-t-il un abonnement ou des frais mensuels ?",
    a: "Non. Rien ne se renouvelle et rien n’est facturé à échéance. Vous payez quand vous rechargez, et votre solde baisse avec les appels d’outils et le calcul que vos serveurs utilisent.",
  },
  {
    q: "J’avais un abonnement Pro. Que devient-il ?",
    a: "Les abonnements Pro sont convertis en crédit : la part non utilisée de votre période en cours est ajoutée à votre solde en crédit payé, l’abonnement est résilié pour qu’il ne se renouvelle plus, et vous recevez un e-mail avec les montants. Vos serveurs, MCP et clés API restent tels quels.",
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
          walletProductSchema({ siteUrl: SITE_URL, path: PATH, locale: "fr" }),
          faqPageSchema(pricingFaqFr.map((f) => ({ q: f.q, a: f.a as string }))),
        ]}
      />
      <TrackOnMount name="pricing_view" />

      <Section>
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <p className="eyebrow mb-4 flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']">
            Tarifs
          </p>
          <h1 className="text-3xl font-medium md:text-4xl">
            Payez à l’usage. {W.signupCredit} offerts pour commencer.
          </h1>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            Sans abonnement. Vous rechargez un solde prépayé et ne payez que ce que vos serveurs
            utilisent : les appels d’outils et le temps CPU actif. À zéro, tout s’arrête : aucune
            facture surprise.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link href={"/fr/inscription" as Route} data-cta-location="tarifs_hero">
                Recevoir {W.signupCredit} de crédit offert
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        <PricingExperience locale="fr" />
        <div className="mx-auto mt-12 max-w-3xl border-y border-border py-4">
          <TrustSignals locale="fr" />
        </div>
      </Section>

      <Section
        bordered
        eyebrow="Votre compte"
        title="Crédit offert, puis paiement à l’usage"
        description="Les mêmes prix avant et après votre première recharge. Alimenter le compte lève les limites qui protègent le crédit offert des abus."
      >
        <ComparisonTable locale="fr" />
      </Section>

      <Faq
        locale="fr"
        items={pricingFaqFr}
        eyebrow="FAQ tarifs"
        title="Vos questions sur les tarifs"
        description="Si une réponse manque, écrivez à hello@twinmcp.fr : nous lisons tout."
        id="faq-tarifs"
      />

      <Section bordered>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 border border-border bg-card px-6 py-12 text-center shadow-sm md:px-12 md:py-14">
          <h2 className="text-balance text-3xl font-medium md:text-4xl">
            Le contexte de votre agent, là où il tourne.
          </h2>
          <div className="h-px w-12 bg-foreground/40" />
          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            Commencez avec {W.signupCredit} offerts. Rechargez seulement quand il vous en faut plus.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/fr/inscription" as Route} data-cta-location="tarifs_final">
                {SIGNUP_OFFER.fr.charAt(0).toUpperCase() + SIGNUP_OFFER.fr.slice(1)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={"/fr/docs#credit" as Route}>Comment fonctionne le crédit</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
