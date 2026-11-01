import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { walletFacts } from "@/components/pricing/wallet-copy";

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

const LAST_UPDATED = "29 octobre 2026";

// Montants cités au §3, depuis la grille du portefeuille (lib/wallet/pricing.ts).
const W = walletFacts("fr");
const SIGNUP_CREDIT = W.signupCredit;
const SIGNUP_DAYS = W.signupDays;
const MIN_TOPUP = W.minTopup;
const MAX_TOPUP = W.maxTopup;
const OVERDRAFT = W.overdraft;

// A legal document in the "Clear sky" style (docs/DESIGN.md): a plain header,
// the text on one white card, numbered sections with brand numerals, the
// identity details and lists as rounded ledgers, underlined blue links.
const EYEBROW = "eyebrow";
const LANG_SWITCH =
  "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent";
const DOC =
  "rounded-2xl border border-border bg-card p-5 text-base leading-7 text-foreground shadow-sm sm:p-10 [&_a:hover]:decoration-2 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-foreground";
const SECTION = "mt-10 border-t border-border pt-8";
const H2 = "flex items-baseline font-display text-xl font-bold tracking-tight sm:text-2xl";
const NUM = "w-10 shrink-0 text-base font-semibold tabular-nums text-brand";
const BODY = "mt-4 space-y-4 sm:pl-10";
const SUBSECTIONS = "mt-6 space-y-8 sm:pl-10";
const SUBSECTION = "space-y-4";
const H3 = "flex items-baseline font-display text-lg font-semibold tracking-tight sm:-ml-10";
const SUBNUM = "w-10 shrink-0 text-sm font-semibold tabular-nums text-brand";
const LEDGER = "divide-y divide-border rounded-xl border border-border tabular-nums";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:items-baseline";
const LIST = "list-disc space-y-2 pl-6 marker:text-muted-foreground";
const MODEL = "rounded-r-lg border-l-4 border-border bg-surface-alt py-3 pl-5 pr-4 text-foreground";
const FOOTER_LINK =
  "inline-flex min-h-10 items-center gap-2 font-medium text-brand underline-offset-4 hover:underline";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-20">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <p className={EYEBROW}>Document légal</p>
          <Link href={"/legal/en/terms" as Route} className={LANG_SWITCH}>
            English
          </Link>
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Conditions d&apos;utilisation
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Dernière mise à jour : {LAST_UPDATED}</p>
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

        {/* TODO(legal-review, 2026-10-29): le §3 a été réécrit pour le crédit
            prépayé (plus d'abonnement, crédit promotionnel d'inscription, recharges
            payantes, recharge automatique, conversion des abonnements). Chaque
            paragraphe du §3 doit être relu par un juriste, et le propriétaire doit
            confirmer : remboursement du crédit payé à la clôture du compte, TVA des
            recharges (bon à usage unique) et du crédit promotionnel, et le parcours
            de rétractation au regard de l'ordonnance n° 2026-2. */}
        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Crédit prépayé et paiement
          </h2>
          <div className={SUBSECTIONS}>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.1</span> Crédit prépayé
              </h3>
              <p>
                Le Service se paie depuis un solde prépayé en euros (le <strong>« crédit »</strong>)
                rattaché à ton Compte. Il n&apos;y a pas d&apos;abonnement et rien ne se renouvelle.
                Ton usage du Service (appels d&apos;outils et temps de calcul, tels qu&apos;indiqués
                sur la <Link href={"/fr/tarifs" as Route}>page tarifaire</Link>) est déduit de ton
                crédit aux prix en vigueur au moment de l&apos;usage.
              </p>
              <p>
                Quand ton crédit atteint zéro, le Service cesse de traiter les requêtes facturables
                et tes serveurs sont mis en pause. Le calcul déjà en cours à ce moment peut faire
                passer ton solde légèrement sous zéro, de {OVERDRAFT} au plus ; ce montant est
                déduit de ta recharge suivante. Nous ne le prélevons jamais sur ton moyen de
                paiement, sauf si tu as activé la recharge automatique (§3.3).
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.2</span> Crédit promotionnel d&apos;inscription
              </h3>
              <p>
                Un nouveau Compte peut recevoir {SIGNUP_CREDIT} de crédit promotionnel, sans
                paiement ni carte, valable {SIGNUP_DAYS} jours à compter de l&apos;inscription, une
                seule fois par personne. Le crédit promotionnel est une réduction sur le Service :
                il n&apos;a <strong>aucune valeur monétaire</strong>, n&apos;est{" "}
                <strong>ni remboursable ni cessible</strong> et ne peut pas être échangé. Il est
                utilisé avant tout crédit payé, et la part non utilisée à la fin de sa validité
                expire. Jusqu&apos;à la première recharge payante, il ne peut être utilisé que dans
                les limites indiquées sur la page tarifaire (un petit serveur ; certains MCP qui
                exécutent du code ou un navigateur sont exclus). Nous pouvons refuser ou annuler un
                crédit promotionnel obtenu au moyen de plusieurs comptes, d&apos;adresses e-mail
                jetables ou de tout autre abus.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.3</span> Recharges, paiement et recharge automatique
              </h3>
              <p>
                Tu achètes du crédit payé en rechargeant ton solde par carte via Stripe, de{" "}
                {MIN_TOPUP} à {MAX_TOPUP} par recharge. Le montant, et la TVA éventuellement
                applicable, est affiché avant le paiement ; le crédit est ajouté une fois le
                paiement confirmé.
              </p>
              <p>
                La recharge automatique est facultative et désactivée par défaut. Si tu
                l&apos;actives, tu nous autorises à débiter la carte enregistrée du montant de
                recharge choisi chaque fois que ton solde passe sous le seuil choisi, sans dépasser
                le plafond mensuel que tu as fixé. Tu peux la modifier ou la désactiver à tout
                moment depuis ta page de facturation.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.4</span> Validité du crédit payé et remboursements
              </h3>
              <p>
                Le crédit payé n&apos;a pas de date d&apos;expiration : il reste disponible tant que
                ton Compte est ouvert. Sauf disposition légale contraire, notamment le droit de
                rétractation (§3.6), le crédit déjà utilisé n&apos;est pas remboursable.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.5</span> Changements de prix
              </h3>
              <p>
                Nous pouvons modifier nos prix avec un préavis minimum de 30 jours. Les nouveaux
                prix ne s&apos;appliquent qu&apos;à l&apos;usage postérieur à leur entrée en vigueur
                ; le crédit déjà acheté conserve sa valeur en euros.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.6</span> Droit de rétractation (consommateurs)
              </h3>
              <p>
                Si tu es un consommateur, tu disposes d&apos;un délai de <strong>14 jours</strong> à
                compter de chaque recharge payante pour te rétracter de cet achat, sans avoir à
                motiver ta décision (articles L221-18 et suivants du Code de la consommation).
              </p>
              <p>
                En rechargeant, tu demandes <strong>expressément</strong> que le crédit soit
                utilisable immédiatement, avant la fin du délai de rétractation. Si tu te rétractes,
                la part de cette recharge que tu n&apos;as pas utilisée t&apos;est remboursée dans
                les 14 jours, sur le moyen de paiement utilisé ; la part déjà utilisée pour te
                fournir le Service reste due (article L221-25).
              </p>
              <p>
                Pour exercer ce droit, envoie-nous une déclaration dénuée d&apos;ambiguïté à{" "}
                <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>, depuis l&apos;adresse email
                associée à ton compte. Tu peux utiliser le modèle suivant (non obligatoire) :
              </p>
              <p className={MODEL}>
                <em>
                  « Je vous notifie par la présente ma rétractation de la recharge de crédit TwinMCP
                  effectuée le [date de la recharge]. Nom : [ton nom]. Email du compte : [email].
                  Date : [date du jour]. »
                </em>
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.7</span> Anciens abonnements
              </h3>
              <p>
                Les abonnements Pro et Team souscrits avant le 29 octobre 2026 sont convertis en
                crédit : la part non utilisée de la période payée en cours est ajoutée à ton solde
                en crédit payé, l&apos;abonnement est résilié pour ne plus se renouveler, et tu es
                informé des montants par email.
              </p>
            </div>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>4.</span> Usage acceptable
          </h2>
          <div className={BODY}>
            <p>Tu t&apos;engages à ne pas :</p>
            <ul className={LIST}>
              <li>
                héberger ou diffuser du contenu illégal, malveillant ou portant atteinte aux droits
                de tiers ;
              </li>
              <li>
                contourner les quotas, limites de débit, ou mécanismes de sécurité du Service ;
              </li>
              <li>utiliser le Service pour attaquer, scanner ou surcharger des systèmes tiers ;</li>
              <li>revendre ou redistribuer l&apos;accès au Service sans autorisation écrite ;</li>
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
              {/* TODO(legal-review, 2026-10-29): disponibilité reformulée après la
                  suppression des offres. */}
              Nous visons une disponibilité de 99,9 % pour les comptes alimentés par une recharge
              payante. Aucun SLA contractuel n&apos;est garanti, en particulier pour les comptes qui
              n&apos;utilisent que le crédit promotionnel. Les maintenances planifiées sont
              annoncées au moins 24 h à l&apos;avance.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>7.</span> Fermeture du compte
          </h2>
          {/* TODO(legal-review, 2026-10-29): §7 réécrit pour le crédit prépayé (plus
              d'abonnement à résilier). Le sort du crédit payé non utilisé à la
              fermeture (remboursement) reste à confirmer avec le juriste (§3.4). */}
          <div className={BODY}>
            <p>
              Il n&apos;y a pas d&apos;abonnement à résilier. Tu peux fermer ton Compte à tout
              moment depuis <strong>Paramètres → Supprimer le compte</strong> ; la fermeture est
              immédiate et supprime les données associées, à l&apos;exception des écritures
              comptables (recharges, factures) que la loi nous oblige à conserver.
            </p>
            <p>
              Tant qu&apos;il reste du crédit payé sur ton Compte, la fermeture se fait en nous
              écrivant à <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>, afin de régler le
              sort de ce crédit (§3.4). Le crédit promotionnel non utilisé est perdu à la fermeture.
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

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 text-sm text-muted-foreground">
        <Link href={"/legal/privacy" as Route} className={FOOTER_LINK}>
          Politique de confidentialité
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </article>
  );
}
