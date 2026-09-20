import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales de TwinMCP : éditeur, directeur de la publication, hébergeur et contact, conformément à la loi pour la confiance dans l'économie numérique (LCEN).",
  alternates: { canonical: "/legal/mentions-legales" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "20 septembre 2026";

// Champs à renseigner avec l'identité réelle de l'éditeur avant la mise en
// production. La LCEN (art. 6-III) impose ces informations pour tout site
// commercial ; tant que les crochets [ ] ne sont pas remplacés, la page n'est
// pas juridiquement complète.
const EDITEUR = {
  denomination: "[à compléter : nom / raison sociale de l'éditeur]",
  formeJuridique: "[à compléter : ex. entrepreneur individuel, SASU, SAS…]",
  adresse: "[à compléter : adresse du siège / du domicile professionnel]",
  siren: "[à compléter : n° SIREN / SIRET]",
  tva: "[à compléter : n° de TVA intracommunautaire, le cas échéant]",
  directeurPublication: "[à compléter : nom du directeur de la publication]",
  email: "hello@twinmcp.fr",
};

const HEBERGEUR = {
  nom: "[à compléter : nom / raison sociale de l'hébergeur]",
  adresse: "[à compléter : adresse de l'hébergeur]",
  telephone: "[à compléter : téléphone de l'hébergeur]",
};

export default function MentionsLegalesPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mb-12 border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Document légal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Mentions légales</h1>
        <p className="mt-3 text-sm text-muted-foreground">Dernière mise à jour : {LAST_UPDATED}</p>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-sm [&_li]:text-muted-foreground [&_dt]:text-sm [&_dt]:font-medium [&_dt]:text-foreground [&_dd]:text-sm [&_dd]:text-muted-foreground">
        <section>
          <p>
            Conformément à l&apos;article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la
            confiance dans l&apos;économie numérique (LCEN), les informations suivantes sont portées
            à la connaissance des utilisateurs du site twinmcp.fr.
          </p>
        </section>

        <h2>1. Éditeur du site</h2>
        <dl>
          <dt>Dénomination</dt>
          <dd>{EDITEUR.denomination}</dd>
          <dt>Forme juridique</dt>
          <dd>{EDITEUR.formeJuridique}</dd>
          <dt>Adresse</dt>
          <dd>{EDITEUR.adresse}</dd>
          <dt>SIREN / SIRET</dt>
          <dd>{EDITEUR.siren}</dd>
          <dt>TVA intracommunautaire</dt>
          <dd>{EDITEUR.tva}</dd>
          <dt>Contact</dt>
          <dd>
            <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>
          </dd>
        </dl>

        <h2>2. Directeur de la publication</h2>
        <p>{EDITEUR.directeurPublication}</p>

        <h2>3. Hébergeur</h2>
        <dl>
          <dt>Nom</dt>
          <dd>{HEBERGEUR.nom}</dd>
          <dt>Adresse</dt>
          <dd>{HEBERGEUR.adresse}</dd>
          <dt>Téléphone</dt>
          <dd>{HEBERGEUR.telephone}</dd>
        </dl>

        <h2>4. Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des contenus du site (textes, éléments graphiques, logo, code) est, sauf
          mention contraire, la propriété de l&apos;éditeur ou fait l&apos;objet d&apos;une
          autorisation d&apos;usage. Toute reproduction ou représentation, totale ou partielle, sans
          autorisation préalable, est interdite. Les marques et logos de tiers cités restent la
          propriété de leurs titulaires respectifs.
        </p>

        <h2>5. Données personnelles</h2>
        <p>
          Le traitement de tes données personnelles est décrit dans notre{" "}
          <Link href={"/legal/privacy" as Route}>politique de confidentialité</Link>, qui précise
          les finalités, les bases légales, les durées de conservation et la manière d&apos;exercer
          tes droits (accès, rectification, effacement, portabilité, opposition, limitation) ainsi
          que ton droit de réclamation auprès de la CNIL.
        </p>

        <h2>6. Contact</h2>
        <p>
          Pour toute question relative au site ou à ces mentions :{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
        </p>
      </div>

      <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
        <Link href={"/legal/privacy" as Route} className="hover:text-foreground">
          Politique de confidentialité
        </Link>
        <Link href={"/legal/terms" as Route} className="hover:text-foreground">
          Conditions d&apos;utilisation
        </Link>
      </footer>
    </article>
  );
}
