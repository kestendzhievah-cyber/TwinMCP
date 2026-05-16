import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment TwinMCP collecte, utilise et protège tes données personnelles. Conformité RGPD.",
  alternates: { canonical: "/legal/privacy" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "12 mai 2026";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mb-12 border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Document légal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Dernière mise à jour : {LAST_UPDATED}
        </p>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-sm [&_li]:text-muted-foreground [&_table]:text-sm [&_th]:font-medium [&_th]:text-foreground [&_td]:text-muted-foreground">
        <section>
          <p>
            Cette politique explique quelles données TwinMCP collecte, pourquoi, avec qui elles
            sont partagées, et comment exercer tes droits. Elle s&apos;applique au site
            twinmcp.com, aux API associées, et au service hébergé d&apos;exécution de serveurs MCP.
          </p>
        </section>

        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement est l&apos;équipe TwinMCP, joignable à{" "}
          <a href="mailto:hello@twinmcp.dev">hello@twinmcp.dev</a>.
        </p>

        <h2>2. Données collectées</h2>
        <h3>2.1 Compte et authentification</h3>
        <ul>
          <li>Adresse email (obligatoire)</li>
          <li>Mot de passe (haché, jamais stocké en clair) ou identifiant OAuth (GitHub, Google)</li>
          <li>Identifiant utilisateur unique généré par Supabase Auth</li>
          <li>Date de création du compte, date de dernière connexion</li>
        </ul>

        <h3>2.2 Facturation</h3>
        <ul>
          <li>
            Informations de paiement (carte, IBAN) : traitées et stockées par Stripe. Nous ne
            voyons jamais les numéros complets.
          </li>
          <li>Plan souscrit, historique de facturation, identifiants Stripe (customer, subscription)</li>
          <li>Adresse de facturation et numéro de TVA si fournis</li>
        </ul>

        <h3>2.3 Usage du service</h3>
        <ul>
          <li>Serveurs MCP créés, MCPs installés, configurations associées</li>
          <li>
            Logs d&apos;audit des requêtes API (méthode, route, code retour, timestamp,
            identifiant de clé)
          </li>
          <li>Adresse IP du client : stockée chiffrée pour rate-limiting et détection d&apos;abus</li>
        </ul>

        <h3>2.4 Analytics et monitoring</h3>
        <ul>
          <li>
            Événements produit (PostHog) : pages vues, clics sur les boutons principaux, étapes du
            funnel d&apos;inscription
          </li>
          <li>Erreurs applicatives (Sentry) : stack traces, navigateur, URL</li>
          <li>Métriques d&apos;infrastructure (Axiom) : latence, codes HTTP, débit</li>
        </ul>

        <h2>3. Pourquoi nous traitons ces données</h2>
        <table>
          <thead>
            <tr>
              <th>Finalité</th>
              <th>Base légale (RGPD art. 6)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Fournir le service (compte, exécution MCP)</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Facturation et paiement</td>
              <td>Exécution du contrat + obligation légale (comptabilité)</td>
            </tr>
            <tr>
              <td>Sécurité, anti-abus, rate-limiting</td>
              <td>Intérêt légitime</td>
            </tr>
            <tr>
              <td>Analytics produit, amélioration du service</td>
              <td>Intérêt légitime (anonymisé) / Consentement</td>
            </tr>
            <tr>
              <td>Emails transactionnels (confirmation, alertes)</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Newsletter ou emails marketing</td>
              <td>Consentement (opt-in, désinscription possible à tout moment)</td>
            </tr>
          </tbody>
        </table>

        <h2>4. Avec qui nous partageons</h2>
        <p>
          Nous n&apos;avons jamais vendu et ne vendrons jamais tes données. Elles sont partagées
          uniquement avec les sous-traitants techniques nécessaires au fonctionnement du service :
        </p>
        <table>
          <thead>
            <tr>
              <th>Sous-traitant</th>
              <th>Rôle</th>
              <th>Localisation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Base de données, authentification</td>
              <td>UE / US (selon région choisie)</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Traitement des paiements</td>
              <td>UE / US</td>
            </tr>
            <tr>
              <td>Upstash</td>
              <td>Cache, rate-limiting, file de tâches</td>
              <td>UE / US</td>
            </tr>
            <tr>
              <td>Cloudflare R2</td>
              <td>Stockage d&apos;objets (documents indexés)</td>
              <td>Mondial (CDN)</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Envoi d&apos;emails transactionnels</td>
              <td>UE</td>
            </tr>
            <tr>
              <td>Sentry</td>
              <td>Monitoring d&apos;erreurs</td>
              <td>UE</td>
            </tr>
            <tr>
              <td>PostHog</td>
              <td>Analytics produit</td>
              <td>UE (région EU)</td>
            </tr>
            <tr>
              <td>Axiom</td>
              <td>Logs d&apos;infrastructure</td>
              <td>UE</td>
            </tr>
          </tbody>
        </table>
        <p>
          Lorsqu&apos;un transfert hors UE est nécessaire, il est encadré par les Clauses
          Contractuelles Types (SCCs) approuvées par la Commission européenne.
        </p>

        <h2>5. Durée de conservation</h2>
        <ul>
          <li>
            <strong>Compte actif :</strong> tant que le compte existe.
          </li>
          <li>
            <strong>Après résiliation :</strong> 30 jours, puis suppression définitive
            (anonymisation des logs d&apos;audit conservés pour obligations légales).
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
        </ul>

        <h2>6. Cookies</h2>
        <p>
          Nous utilisons un nombre minimal de cookies :
        </p>
        <ul>
          <li>
            <strong>Session Supabase</strong> (essentiel) : maintient ta session connectée.
          </li>
          <li>
            <strong>PostHog</strong> (analytics) : déposé uniquement après ton consentement.
          </li>
          <li>
            <strong>Préférences</strong> (thème clair/sombre, langue) : stockés dans localStorage,
            jamais transmis au serveur.
          </li>
        </ul>

        <h2>7. Tes droits (RGPD)</h2>
        <p>
          Conformément au Règlement Général sur la Protection des Données, tu disposes des droits
          suivants :
        </p>
        <ul>
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
          Pour exercer ces droits, écris à{" "}
          <a href="mailto:hello@twinmcp.dev">hello@twinmcp.dev</a>. Nous répondons sous 30 jours.
        </p>

        <h2>8. Sécurité</h2>
        <p>
          Nous appliquons des mesures techniques et organisationnelles standards de
          l&apos;industrie : chiffrement TLS en transit, chiffrement au repos, hachage des mots de
          passe (bcrypt via Supabase), isolation par RLS Postgres, audit logs, accès restreint au
          principe du moindre privilège.
        </p>
        <p>
          En cas de violation de données affectant tes droits, tu seras notifié dans les 72 heures
          conformément à l&apos;article 34 du RGPD.
        </p>

        <h2>9. Mineurs</h2>
        <p>
          Le service n&apos;est pas destiné aux personnes de moins de 16 ans. Nous ne collectons
          pas sciemment de données les concernant. Si tu penses qu&apos;un mineur nous a fourni
          des données, contacte-nous pour suppression immédiate.
        </p>

        <h2>10. Modifications de cette politique</h2>
        <p>
          Cette politique peut évoluer. Les changements majeurs sont notifiés par email au moins
          30 jours avant leur entrée en vigueur. L&apos;historique des versions est disponible sur
          demande.
        </p>

        <h2>11. Contact</h2>
        <p>
          Toute question concernant cette politique :{" "}
          <a href="mailto:hello@twinmcp.dev">hello@twinmcp.dev</a>.
        </p>
      </div>

      <footer className="mt-16 border-t border-border/60 pt-6 text-xs text-muted-foreground">
        <Link href={"/legal/terms" as Route} className="hover:text-foreground">
          ← Conditions d&apos;utilisation
        </Link>
      </footer>
    </article>
  );
}
