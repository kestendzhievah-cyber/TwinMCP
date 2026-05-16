import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Conditions générales d'utilisation du service TwinMCP — droits, obligations, facturation, résiliation.",
  alternates: { canonical: "/legal/terms" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "12 mai 2026";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mb-12 border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Document légal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Conditions d&apos;utilisation</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Dernière mise à jour : {LAST_UPDATED}
        </p>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-sm [&_li]:text-muted-foreground">
        <section>
          <p>
            Bienvenue sur TwinMCP. En créant un compte ou en utilisant le service, tu acceptes les
            conditions ci-dessous. Si tu n&apos;es pas d&apos;accord, n&apos;utilise pas le service.
          </p>
        </section>

        <h2>1. Définitions</h2>
        <p>
          <strong>« Service »</strong> désigne la plateforme TwinMCP accessible à l&apos;adresse
          twinmcp.com, ses API, et tous les sous-domaines associés.{" "}
          <strong>« Compte »</strong> désigne l&apos;espace personnel créé via inscription.{" "}
          <strong>« Contenu »</strong> désigne les serveurs MCP, configurations, clés et données que
          tu fournis ou génères via le Service.
        </p>

        <h2>2. Inscription et compte</h2>
        <p>
          Tu dois avoir au moins 16 ans (ou l&apos;âge légal de ta juridiction) pour créer un
          compte. Les informations fournies à l&apos;inscription doivent être exactes. Tu es seul
          responsable de la confidentialité de tes identifiants et de toute activité sur ton
          compte.
        </p>
        <p>
          Nous nous réservons le droit de suspendre ou supprimer un compte en cas d&apos;usage
          abusif, frauduleux, ou contraire à ces conditions.
        </p>

        <h2>3. Plans et facturation</h2>
        <h3>3.1 Plan gratuit</h3>
        <p>
          Le plan Free est fourni sans frais et sans carte bancaire. Il inclut un quota limité
          décrit sur la <Link href={"/plans" as Route}>page tarifaire</Link>. Nous pouvons modifier
          ces limites avec un préavis de 30 jours.
        </p>
        <h3>3.2 Plans payants</h3>
        <p>
          Les abonnements Pro et Team sont facturés mensuellement ou annuellement via Stripe. Le
          paiement est dû à l&apos;avance et non remboursable une fois la période entamée, sauf
          mention contraire (cf. §3.3).
        </p>
        <h3>3.3 Remboursements</h3>
        <p>
          Tu peux demander un remboursement intégral dans les 7 jours suivant la souscription
          initiale d&apos;un plan payant. Au-delà, le plan reste actif jusqu&apos;au terme de la
          période payée et aucun remboursement prorata n&apos;est accordé.
        </p>
        <h3>3.4 Changements de prix</h3>
        <p>
          Toute modification des tarifs s&apos;applique à partir de la prochaine période de
          facturation, avec un préavis minimum de 30 jours.
        </p>

        <h2>4. Usage acceptable</h2>
        <p>Tu t&apos;engages à ne pas :</p>
        <ul>
          <li>héberger ou diffuser du contenu illégal, malveillant ou portant atteinte aux droits de tiers ;</li>
          <li>contourner les quotas, limites de débit, ou mécanismes de sécurité du Service ;</li>
          <li>utiliser le Service pour attaquer, scanner ou surcharger des systèmes tiers ;</li>
          <li>revendre ou redistribuer l&apos;accès au Service sans autorisation écrite ;</li>
          <li>tenter de rétro-ingénierer, désassembler ou cloner le Service.</li>
        </ul>

        <h2>5. Propriété intellectuelle</h2>
        <p>
          Tu conserves la propriété de ton Contenu. Tu nous accordes une licence non-exclusive,
          mondiale et limitée nécessaire pour héberger, traiter et délivrer ton Contenu via le
          Service.
        </p>
        <p>
          Le code source de TwinMCP, ses marques et son design restent notre propriété exclusive.
        </p>

        <h2>6. Disponibilité et SLA</h2>
        <p>
          Nous visons une disponibilité de 99,9 % sur les plans Pro et Team. Aucun SLA contractuel
          n&apos;est garanti sur le plan Free. Les maintenances planifiées sont annoncées au moins
          24 h à l&apos;avance.
        </p>

        <h2>7. Résiliation</h2>
        <p>
          Tu peux résilier ton compte à tout moment depuis l&apos;onglet Billing du dashboard. La
          résiliation prend effet à la fin de la période de facturation en cours. Tes données sont
          conservées 30 jours après résiliation pour permettre une réactivation, puis supprimées
          définitivement.
        </p>

        <h2>8. Limitation de responsabilité</h2>
        <p>
          Le Service est fourni « tel quel ». Dans la mesure permise par la loi, notre
          responsabilité totale ne peut excéder le montant payé par toi sur les 12 derniers mois.
          Nous ne sommes pas responsables des pertes indirectes (perte de données, manque à gagner,
          interruption d&apos;activité).
        </p>

        <h2>9. Modifications</h2>
        <p>
          Nous pouvons mettre à jour ces conditions. Les modifications substantielles sont
          notifiées par email au moins 30 jours avant leur entrée en vigueur. Continuer à utiliser
          le Service après cette date vaut acceptation.
        </p>

        <h2>10. Droit applicable</h2>
        <p>
          Ces conditions sont régies par le droit français. Tout litige sera soumis aux tribunaux
          compétents, sous réserve des dispositions impératives en matière de consommation.
        </p>

        <h2>11. Contact</h2>
        <p>
          Pour toute question, écris-nous à{" "}
          <a href="mailto:hello@twinmcp.dev">hello@twinmcp.dev</a>.
        </p>
      </div>

      <footer className="mt-16 border-t border-border/60 pt-6 text-xs text-muted-foreground">
        <Link href={"/legal/privacy" as Route} className="hover:text-foreground">
          Politique de confidentialité →
        </Link>
      </footer>
    </article>
  );
}
