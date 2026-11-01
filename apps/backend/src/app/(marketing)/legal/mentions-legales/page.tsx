import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { EDITEUR, HEBERGEUR } from "@/lib/legal/entity";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales de TwinMCP : éditeur, directeur de la publication, hébergeur et contact, conformément à la loi pour la confiance dans l'économie numérique (LCEN).",
  alternates: {
    canonical: "/legal/mentions-legales",
    languages: { fr: "/legal/mentions-legales", en: "/legal/en/notice" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "20 septembre 2026";

// A legal document in the "Clear sky" style (docs/DESIGN.md): a plain header,
// the text on one white card, numbered sections with brand numerals, the
// identity details and lists as rounded ledgers, underlined blue links.
const EYEBROW = "eyebrow";
const LANG_SWITCH =
  "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent";
const DOC =
  "rounded-2xl border border-border bg-card p-5 text-base leading-7 text-foreground shadow-sm sm:p-10 [&_a:hover]:decoration-2 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4";
const SECTION = "mt-10 border-t border-border pt-8";
const H2 = "flex items-baseline font-display text-xl font-bold tracking-tight sm:text-2xl";
const NUM = "w-10 shrink-0 text-base font-semibold tabular-nums text-brand";
const BODY = "mt-4 space-y-4 sm:pl-10";
const LEDGER = "divide-y divide-border rounded-xl border border-border tabular-nums";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:items-baseline";
const LEDGER_TERM = "text-sm font-medium text-muted-foreground";
const FOOTER_LINK =
  "inline-flex min-h-10 items-center gap-2 font-medium text-brand underline-offset-4 hover:underline";

export default function MentionsLegalesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-20">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <p className={EYEBROW}>Document légal</p>
          <Link href={"/legal/en/notice" as Route} className={LANG_SWITCH}>
            English
          </Link>
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Mentions légales
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Dernière mise à jour : {LAST_UPDATED}</p>
      </header>

      <div className={DOC}>
        <section className="space-y-4">
          <p>
            Conformément à l&apos;article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la
            confiance dans l&apos;économie numérique (LCEN), les informations suivantes sont portées
            à la connaissance des utilisateurs du site twinmcp.fr.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>1.</span> Éditeur du site
          </h2>
          <div className={BODY}>
            <dl className={LEDGER}>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Dénomination</dt>
                <dd>{EDITEUR.denomination}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Forme juridique</dt>
                <dd>{EDITEUR.formeJuridique}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Adresse</dt>
                <dd>{EDITEUR.adresse}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>
                  N° d&apos;immatriculation (EIK — registre du commerce bulgare)
                </dt>
                <dd>{EDITEUR.immatriculation}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Capital social</dt>
                <dd>{EDITEUR.capital}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>TVA intracommunautaire</dt>
                <dd>{EDITEUR.tva}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Contact</dt>
                <dd>
                  <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>2.</span> Directeur de la publication
          </h2>
          <div className={BODY}>
            <p>{EDITEUR.directeurPublication}</p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Hébergeur
          </h2>
          <div className={BODY}>
            <dl className={LEDGER}>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Nom</dt>
                <dd>{HEBERGEUR.nom}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Adresse</dt>
                <dd>{HEBERGEUR.adresse}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Téléphone</dt>
                <dd>{HEBERGEUR.telephone}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>4.</span> Propriété intellectuelle
          </h2>
          <div className={BODY}>
            <p>
              L&apos;ensemble des contenus du site (textes, éléments graphiques, logo, code) est,
              sauf mention contraire, la propriété de l&apos;éditeur ou fait l&apos;objet d&apos;une
              autorisation d&apos;usage. Toute reproduction ou représentation, totale ou partielle,
              sans autorisation préalable, est interdite. Les marques et logos de tiers cités
              restent la propriété de leurs titulaires respectifs.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>5.</span> Données personnelles
          </h2>
          <div className={BODY}>
            <p>
              Le traitement de tes données personnelles est décrit dans notre{" "}
              <Link href={"/legal/privacy" as Route}>politique de confidentialité</Link>, qui
              précise les finalités, les bases légales, les durées de conservation et la manière
              d&apos;exercer tes droits (accès, rectification, effacement, portabilité, opposition,
              limitation) ainsi que ton droit de réclamation auprès de la CNIL.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>6.</span> Contact
          </h2>
          <div className={BODY}>
            <p>
              Pour toute question relative au site ou à ces mentions :{" "}
              <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
            </p>
          </div>
        </section>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 text-sm text-muted-foreground">
        <Link href={"/legal/privacy" as Route} className={FOOTER_LINK}>
          Politique de confidentialité
        </Link>
        <span aria-hidden>·</span>
        <Link href={"/legal/terms" as Route} className={FOOTER_LINK}>
          Conditions d&apos;utilisation
        </Link>
      </footer>
    </article>
  );
}
