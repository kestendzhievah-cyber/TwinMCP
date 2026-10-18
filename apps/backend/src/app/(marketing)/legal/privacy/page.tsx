import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment TwinMCP collecte, utilise et protège tes données personnelles. Conformité RGPD.",
  alternates: {
    canonical: "/legal/privacy",
    languages: { fr: "/legal/privacy", en: "/legal/en/privacy" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "18 octobre 2026";

// Typeset as a document on the card stock (docs/DESIGN.md §4–5): a centred
// header over the double rule, numbered sections with hanging small-caps
// numerals, the purposes and sub-processors as ledger tables, the labelled
// lists between hairlines, pinstripe links.
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
const SUBSECTION = "space-y-3";
const H3 = "flex items-baseline text-xl font-medium sm:-ml-10";
const SUBNUM = "smallcaps lining w-10 shrink-0 text-sm font-normal text-muted-foreground";
const LIST = "list-disc space-y-2 pl-6 marker:text-muted-foreground";
const RULED = "lining divide-y divide-border border-y border-border [&>li]:py-3";
const LEDGER = "border-b border-border";
const CELL = "align-top";
const FOOTER_LINK = "inline-flex min-h-10 items-center gap-2 hover:text-foreground";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      {/* The document header: the language switch in the top-right corner,
          then the centred name — eyebrow between rules, the title, a short
          rule, the dateline — over the double rule. */}
      <header className="mb-10">
        <div className="flex justify-end">
          <Link href={"/legal/en/privacy" as Route} className={LANG_SWITCH}>
            English
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className={EYEBROW}>Document légal</p>
          <h1 className="letterpress mt-6 text-4xl font-medium sm:text-5xl">
            Politique de confidentialité
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
            Cette politique explique quelles données TwinMCP collecte, pourquoi, avec qui elles sont
            partagées, et comment exercer tes droits. Elle s&apos;applique au site twinmcp.fr, aux
            API associées, et au service hébergé d&apos;exécution de serveurs MCP.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>1.</span> Responsable du traitement
          </h2>
          <div className={BODY}>
            <p>
              Le responsable du traitement est l&apos;éditeur de TwinMCP, dont l&apos;identité
              complète (dénomination, forme juridique, adresse, SIREN) figure dans les{" "}
              <Link href={"/legal/mentions-legales" as Route}>mentions légales</Link>. Il est
              joignable à <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>2.</span> Données collectées
          </h2>
          <div className={SUBSECTIONS}>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.1</span> Compte et authentification
              </h3>
              <ul className={LIST}>
                <li>Adresse email (obligatoire)</li>
                <li>
                  Mot de passe (haché, jamais stocké en clair) ou identifiant OAuth (GitHub, Google)
                </li>
                <li>Identifiant utilisateur unique généré par Supabase Auth</li>
                <li>Date de création du compte, date de dernière connexion</li>
              </ul>
            </div>

            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.2</span> Facturation
              </h3>
              <ul className={LIST}>
                <li>
                  Informations de paiement (carte, IBAN) : traitées et stockées par Stripe. Nous ne
                  voyons jamais les numéros complets.
                </li>
                <li>
                  Plan souscrit, historique de facturation, identifiants Stripe (customer,
                  subscription)
                </li>
                <li>Adresse de facturation et numéro de TVA si fournis</li>
              </ul>
            </div>

            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.3</span> Usage du service
              </h3>
              <ul className={LIST}>
                <li>Serveurs MCP créés, MCPs installés, configurations associées</li>
                <li>
                  Logs d&apos;audit des requêtes API (méthode, route, code retour, timestamp,
                  identifiant de clé)
                </li>
                <li>
                  Adresse IP de la requête : enregistrée dans les journaux d&apos;audit (que tu peux
                  consulter dans ton tableau de bord) pour la sécurité et la détection d&apos;abus.
                  Le rate-limiting, lui, s&apos;applique par compte et non par adresse IP.
                </li>
              </ul>
            </div>

            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.4</span> Analytics et monitoring
              </h3>
              <ul className={LIST}>
                <li>
                  Événements produit (PostHog) : pages vues, clics sur les boutons principaux,
                  étapes du funnel d&apos;inscription
                </li>
                <li>
                  Mesure publicitaire (Google Ads), uniquement avec ton consentement : arrivée sur
                  le site depuis une de nos annonces, inscription
                </li>
                <li>Erreurs applicatives (Sentry) : stack traces, navigateur, URL</li>
                <li>Métriques d&apos;infrastructure (Axiom) : latence, codes HTTP, débit</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Pourquoi nous traitons ces données
          </h2>
          <div className={BODY}>
            <Table className={LEDGER}>
              <TableHeader>
                <TableRow>
                  <TableHead>Finalité</TableHead>
                  <TableHead>Base légale (RGPD art. 6)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className={CELL}>Fournir le service (compte, exécution MCP)</TableCell>
                  <TableCell className={CELL}>Exécution du contrat</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Facturation et paiement</TableCell>
                  <TableCell className={CELL}>
                    Exécution du contrat + obligation légale (comptabilité)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Sécurité, anti-abus, rate-limiting</TableCell>
                  <TableCell className={CELL}>Intérêt légitime</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Analytics produit, amélioration du service</TableCell>
                  <TableCell className={CELL}>
                    Intérêt légitime (anonymisé) / Consentement
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>
                    Mesure de l&apos;efficacité de nos publicités (Google Ads)
                  </TableCell>
                  <TableCell className={CELL}>Consentement</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>
                    Emails transactionnels (confirmation, alertes)
                  </TableCell>
                  <TableCell className={CELL}>Exécution du contrat</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Newsletter ou emails marketing</TableCell>
                  <TableCell className={CELL}>
                    Consentement (opt-in, désinscription possible à tout moment)
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>4.</span> Avec qui nous partageons
          </h2>
          <div className={BODY}>
            <p>
              Nous n&apos;avons jamais vendu et ne vendrons jamais tes données. Elles sont partagées
              uniquement avec les sous-traitants techniques nécessaires au fonctionnement du service
              :
            </p>
            <Table className={LEDGER}>
              <TableHeader>
                <TableRow>
                  <TableHead>Sous-traitant</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Localisation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Supabase</TableCell>
                  <TableCell className={CELL}>Base de données, authentification</TableCell>
                  <TableCell className={CELL}>UE / US (selon région choisie)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Stripe</TableCell>
                  <TableCell className={CELL}>Traitement des paiements</TableCell>
                  <TableCell className={CELL}>UE / US</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Upstash</TableCell>
                  <TableCell className={CELL}>Cache, rate-limiting, file de tâches</TableCell>
                  <TableCell className={CELL}>UE / US</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>OpenAI</TableCell>
                  <TableCell className={CELL}>
                    Génération d&apos;embeddings pour l&apos;indexation et la recherche de documents
                  </TableCell>
                  <TableCell className={CELL}>États-Unis</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Resend</TableCell>
                  <TableCell className={CELL}>Envoi d&apos;emails transactionnels</TableCell>
                  <TableCell className={CELL}>UE</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Sentry</TableCell>
                  <TableCell className={CELL}>
                    Monitoring d&apos;erreurs (sans cookie ni enregistrement de session)
                  </TableCell>
                  <TableCell className={CELL}>UE</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>PostHog</TableCell>
                  <TableCell className={CELL}>Analytics produit</TableCell>
                  <TableCell className={CELL}>UE (région EU)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>
                    Google (Google Ireland Ltd)
                  </TableCell>
                  <TableCell className={CELL}>
                    Mesure des conversions publicitaires (Google Ads), après consentement
                  </TableCell>
                  <TableCell className={CELL}>UE / US</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Axiom</TableCell>
                  <TableCell className={CELL}>Logs d&apos;infrastructure</TableCell>
                  <TableCell className={CELL}>UE</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Hébergeur du site</TableCell>
                  <TableCell className={CELL}>
                    Hébergement du serveur applicatif (identité complète dans les mentions légales)
                  </TableCell>
                  <TableCell className={CELL}>UE</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p>
              Lorsqu&apos;un transfert hors UE est nécessaire, il est encadré par les Clauses
              Contractuelles Types (SCCs) approuvées par la Commission européenne.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>5.</span> Durée de conservation
          </h2>
          <div className={BODY}>
            <ul className={RULED}>
              <li>
                <strong>Compte actif :</strong> tant que le compte existe.
              </li>
              <li>
                <strong>Suppression du compte :</strong> immédiate — compte, serveurs, clés et
                identité d&apos;authentification supprimés. Les journaux d&apos;audit conservés pour
                la sécurité et nos obligations légales sont anonymisés (identifiant utilisateur et
                adresse IP retirés).
              </li>
              <li>
                <strong>Données de facturation :</strong> 10 ans (obligation comptable française).
              </li>
              <li>
                <strong>Logs techniques :</strong> 90 jours.
              </li>
              <li>
                <strong>Cookies analytics :</strong> 13 mois maximum.
              </li>
              <li>
                <strong>Cookies publicitaires :</strong> 13 mois maximum.
              </li>
            </ul>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>6.</span> Cookies
          </h2>
          <div className={BODY}>
            <p>Nous utilisons un nombre minimal de cookies :</p>
            <ul className={RULED}>
              <li>
                <strong>Session Supabase</strong> (essentiel) : maintient ta session connectée.
              </li>
              <li>
                <strong>PostHog</strong> (analytics) : déposé uniquement après ton consentement.
              </li>
              <li>
                <strong>Google Ads</strong> (publicité) : déposé uniquement après ton consentement,
                pour mesurer les visites et inscriptions qui viennent de nos annonces.
              </li>
              <li>
                <strong>Préférences</strong> (thème clair/sombre, langue) : stockés dans
                localStorage, jamais transmis au serveur.
              </li>
            </ul>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>7.</span> Tes droits (RGPD)
          </h2>
          <div className={BODY}>
            <p>
              Conformément au Règlement Général sur la Protection des Données, tu disposes des
              droits suivants :
            </p>
            <ul className={RULED}>
              <li>
                <strong>Accès :</strong> recevoir une copie de tes données.
              </li>
              <li>
                <strong>Rectification :</strong> corriger des données inexactes.
              </li>
              <li>
                <strong>Effacement :</strong> demander la suppression (« droit à l&apos;oubli »).
              </li>
              <li>
                <strong>Portabilité :</strong> recevoir tes données dans un format structuré.
              </li>
              <li>
                <strong>Opposition :</strong> t&apos;opposer à un traitement basé sur notre intérêt
                légitime.
              </li>
              <li>
                <strong>Limitation :</strong> restreindre temporairement le traitement.
              </li>
              <li>
                <strong>Réclamation :</strong> introduire une plainte auprès de la CNIL.
              </li>
            </ul>
            <p>
              Tu peux exercer directement ton droit à l&apos;effacement depuis{" "}
              <strong>Paramètres → Supprimer le compte</strong> : cela supprime ton compte, tes
              serveurs, tes clés et ton identité d&apos;authentification, et anonymise tes journaux
              d&apos;audit. Pour les autres droits (accès, portabilité, rectification, opposition,
              limitation), écris à <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a> — nous
              répondons sous 30 jours.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>8.</span> Sécurité
          </h2>
          <div className={BODY}>
            <p>
              Nous appliquons des mesures techniques et organisationnelles standards de
              l&apos;industrie : chiffrement TLS en transit, chiffrement au repos, hachage des mots
              de passe (bcrypt via Supabase), isolation par RLS Postgres, audit logs, accès
              restreint au principe du moindre privilège.
            </p>
            <p>
              En cas de violation de données susceptible d&apos;engendrer un risque élevé pour tes
              droits et libertés, nous te notifions dans les meilleurs délais (RGPD art. 34) et
              informons la CNIL dans les 72 heures (RGPD art. 33).
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>9.</span> Mineurs
          </h2>
          <div className={BODY}>
            <p>
              Le service n&apos;est pas destiné aux mineurs. En France, le traitement des données
              d&apos;un enfant de moins de 15 ans requiert le consentement d&apos;un titulaire de
              l&apos;autorité parentale (art. 45 de la loi Informatique et Libertés). Nous ne
              collectons pas sciemment de données concernant des enfants de moins de 15 ans ; si tu
              penses que c&apos;est le cas, contacte-nous pour suppression immédiate.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>10.</span> Modifications de cette politique
          </h2>
          <div className={BODY}>
            <p>
              Cette politique peut évoluer. Les changements majeurs sont notifiés par email au moins
              30 jours avant leur entrée en vigueur. L&apos;historique des versions est disponible
              sur demande.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>11.</span> Contact
          </h2>
          <div className={BODY}>
            <p>
              Toute question concernant cette politique :{" "}
              <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>.
            </p>
          </div>
        </section>
      </div>

      <footer className="rule-double smallcaps tracking-sc mt-16 flex flex-wrap items-center justify-center gap-x-3 pt-4 text-xs text-muted-foreground">
        <Link href={"/legal/terms" as Route} className={FOOTER_LINK}>
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Conditions d&apos;utilisation
        </Link>
      </footer>
    </article>
  );
}
