import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Conditions générales d'utilisation du service TwinMCP — droits, obligations, facturation, résiliation.",
  alternates: {
    canonical: "/legal/terms",
    languages: { fr: "/legal/terms", en: "/legal/en/terms" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "13 octobre 2026";

// Typeset as a document on the card stock (docs/DESIGN.md §4–5): a centred
// header over the double rule, numbered sections with hanging small-caps
// numerals, the definitions as a hairline ledger, pinstripe links.
const EYEBROW =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']";
const LANG_SWITCH =
  "smallcaps tracking-sc inline-flex min-h-10 items-center text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground/60";
const DOC =
  "text-base leading-7 text-foreground [&_a:hover]:decoration-brand [&_a]:text-brand [&_a]:underline [&_a]:decoration-brand/40 [&_a]:underline-offset-4 [&_strong]:font-medium [&_strong]:text-foreground";
const SECTION = "mt-10 border-t border-border pt-8";
const H2 = "flex items-baseline text-2xl font-medium";
const NUM = "smallcaps lining w-10 shrink-0 text-base font-normal text-muted-foreground";
const BODY = "mt-4 space-y-4 sm:pl-10";
const SUBSECTIONS = "mt-6 space-y-8 sm:pl-10";
const SUBSECTION = "space-y-4";
const H3 = "flex items-baseline text-xl font-medium sm:-ml-10";
const SUBNUM = "smallcaps lining w-10 shrink-0 text-sm font-normal text-muted-foreground";
const LEDGER = "divide-y divide-border border-y border-t-foreground/50";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8rem_1fr] sm:items-baseline";
const LIST = "list-disc space-y-2 pl-6 marker:text-muted-foreground";
const MODEL = "border-l-2 border-foreground/40 pl-5 text-foreground/80";
const FOOTER_LINK = "inline-flex min-h-10 items-center gap-2 hover:text-foreground";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      {/* The document header: the language switch in the top-right corner,
          then the centred name — eyebrow between rules, the title, a short
          rule, the dateline — over the double rule. */}
      <header className="mb-10">
        <div className="flex justify-end">
          <Link href={"/legal/en/terms" as Route} className={LANG_SWITCH}>
            English
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className={EYEBROW}>Document légal</p>
          <h1 className="letterpress mt-6 text-4xl font-medium sm:text-5xl">
            Conditions d&apos;utilisation
          </h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
          <p className="lining mt-6 text-sm italic text-muted-foreground">
            Dernière mise à jour : {LAST_UPDATED}
          </p>
        </div>
        <Separator variant="double" className="mt-10" />
      </header>

      <div className={DOC}>
        <section className="space-y-4">
          <p>
            Bienvenue sur TwinMCP. En créant un compte ou en utilisant le service, tu acceptes les
            conditions ci-dessous. Si tu n&apos;es pas d&apos;accord, n&apos;utilise pas le service.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>1.</span> Définitions
          </h2>
          <div className={BODY}>
            <dl className={LEDGER}>
              <div className={LEDGER_ROW}>
                <dt>
                  <strong>« Service »</strong>
                </dt>
                <dd>
                  désigne la plateforme TwinMCP accessible à l&apos;adresse twinmcp.fr, ses API, et
                  tous les sous-domaines associés.
                </dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt>
                  <strong>« Compte »</strong>
                </dt>
                <dd>désigne l&apos;espace personnel créé via inscription.</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt>
                  <strong>« Contenu »</strong>
                </dt>
                <dd>
                  désigne les serveurs MCP, configurations, clés et données que tu fournis ou
                  génères via le Service.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>2.</span> Inscription et compte
          </h2>
          <div className={BODY}>
            <p>
              Tu dois avoir au moins 16 ans (ou l&apos;âge légal de ta juridiction) pour créer un
              compte. Les informations fournies à l&apos;inscription doivent être exactes. Tu es
              seul responsable de la confidentialité de tes identifiants et de toute activité sur
              ton compte.
            </p>
            <p>
              Nous nous réservons le droit de suspendre ou supprimer un compte en cas d&apos;usage
              abusif, frauduleux, ou contraire à ces conditions.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Plans et facturation
          </h2>
          <div className={SUBSECTIONS}>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.1</span> Plan gratuit
              </h3>
              <p>
                Le plan Free est fourni sans frais et sans carte bancaire. Il inclut un quota limité
                décrit sur la <Link href={"/plans" as Route}>page tarifaire</Link>. Nous pouvons
                modifier ces limites avec un préavis de 30 jours.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.2</span> Plans payants
              </h3>
              <p>
                Les abonnements Pro et Team sont facturés mensuellement ou annuellement via Stripe.
                Le paiement est dû à l&apos;avance et non remboursable une fois la période entamée,
                sauf mention contraire (cf. §3.3 et, pour les consommateurs, §3.5).
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.3</span> Remboursements (garantie commerciale)
              </h3>
              <p>
                Tu peux demander un remboursement intégral dans les 7 jours suivant la souscription
                initiale d&apos;un plan payant. Au-delà, le plan reste actif jusqu&apos;au terme de
                la période payée et aucun remboursement prorata n&apos;est accordé. Cette garantie
                commerciale s&apos;ajoute au droit légal de rétractation des consommateurs (§3.5) et
                ne le remplace pas.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.4</span> Changements de prix
              </h3>
              <p>
                Toute modification des tarifs s&apos;applique à partir de la prochaine période de
                facturation, avec un préavis minimum de 30 jours.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.5</span> Droit de rétractation (consommateurs)
              </h3>
              <p>
                Si tu es un consommateur, tu disposes d&apos;un délai de <strong>14 jours</strong> à
                compter de la souscription d&apos;un abonnement payant pour te rétracter, sans avoir
                à motiver ta décision (articles L221-18 et suivants du Code de la consommation).
              </p>
              <p>
                En souscrivant un abonnement, tu demandes <strong>expressément</strong> que le
                Service te soit fourni immédiatement, sans attendre l&apos;expiration du délai de
                rétractation. Si tu exerces ton droit de rétractation après ce début
                d&apos;exécution, tu restes redevable du prix correspondant au service déjà fourni
                jusqu&apos;à la notification de ta rétractation, calculé au prorata ; le solde
                t&apos;est remboursé dans les 14 jours, sur le moyen de paiement utilisé (article
                L221-25).
              </p>
              <p>
                Pour exercer ce droit, envoie-nous une déclaration dénuée d&apos;ambiguïté à{" "}
                <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>, depuis l&apos;adresse email
                associée à ton compte. Tu peux utiliser le modèle suivant (non obligatoire) :
              </p>
              <p className={MODEL}>
                <em>
                  « Je vous notifie par la présente ma rétractation du contrat portant sur
                  l&apos;abonnement TwinMCP souscrit le [date de souscription]. Nom : [ton nom].
                  Email du compte : [email]. Date : [date du jour]. »
                </em>
              </p>
            </div>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>4.</span> Usage acceptable
          </h2>
          <div className={BODY}>
            <p>Tu t&apos;engages à ne pas :</p>
            <ul className={LIST}>
              <li>
                héberger ou diffuser du contenu illégal, malveillant ou portant atteinte aux droits
                de tiers ;
              </li>
              <li>
                contourner les quotas, limites de débit, ou mécanismes de sécurité du Service ;
              </li>
              <li>utiliser le Service pour attaquer, scanner ou surcharger des systèmes tiers ;</li>
              <li>revendre ou redistribuer l&apos;accès au Service sans autorisation écrite ;</li>
              <li>tenter de rétro-ingénierer, désassembler ou cloner le Service.</li>
            </ul>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>5.</span> Propriété intellectuelle
          </h2>
          <div className={BODY}>
            <p>
              Tu conserves la propriété de ton Contenu. Tu nous accordes une licence non-exclusive,
              mondiale et limitée nécessaire pour héberger, traiter et délivrer ton Contenu via le
              Service.
            </p>
            <p>
              Le code source de TwinMCP, ses marques et son design restent notre propriété
              exclusive.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>6.</span> Disponibilité et SLA
          </h2>
          <div className={BODY}>
            <p>
              Nous visons une disponibilité de 99,9 % sur les plans Pro et Team. Aucun SLA
              contractuel n&apos;est garanti sur le plan Free. Les maintenances planifiées sont
              annoncées au moins 24 h à l&apos;avance.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>7.</span> Résiliation
          </h2>
          <div className={BODY}>
            <p>
              Tu peux résilier ton abonnement à tout moment depuis l&apos;onglet Billing du
              dashboard ; la résiliation prend effet à la fin de la période de facturation en cours
              et ton compte repasse alors au plan gratuit. Tu peux aussi supprimer ton compte et
              toutes les données associées immédiatement depuis{" "}
              <strong>Paramètres → Supprimer le compte</strong>.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>8.</span> Limitation de responsabilité
          </h2>
          <div className={BODY}>
            <p>
              Le Service est fourni « tel quel ». Dans la mesure permise par la loi, notre
              responsabilité totale ne peut excéder le montant payé par toi sur les 12 derniers
              mois. Nous ne sommes pas responsables des pertes indirectes (perte de données, manque
              à gagner, interruption d&apos;activité).
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>9.</span> Modifications
          </h2>
          <div className={BODY}>
            <p>
              Nous pouvons mettre à jour ces conditions. Les modifications substantielles sont
              notifiées par email au moins 30 jours avant leur entrée en vigueur. Continuer à
              utiliser le Service après cette date vaut acceptation.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>10.</span> Droit applicable
          </h2>
          <div className={BODY}>
            <p>
              Ces conditions sont régies par le droit français. Tout litige sera soumis aux
              tribunaux compétents, sous réserve des dispositions impératives en matière de
              consommation.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>11.</span> Contact
          </h2>
          <div className={BODY}>
            <p>
              Pour toute question, écris-nous à{" "}
              <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>.
            </p>
          </div>
        </section>
      </div>

      <footer className="rule-double smallcaps tracking-sc mt-16 flex flex-wrap items-center justify-center gap-x-3 pt-4 text-xs text-muted-foreground">
        <Link href={"/legal/privacy" as Route} className={FOOTER_LINK}>
          Politique de confidentialité
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </article>
  );
}
