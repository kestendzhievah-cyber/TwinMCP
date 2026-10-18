import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Separator } from "@/components/ui/separator";
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

// Typeset as a document on the card stock (docs/DESIGN.md §4–5): a centred
// header over the double rule, numbered sections with hanging small-caps
// numerals, the identity details as hairline ledgers, pinstripe links.
const EYEBROW =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']";
const LANG_SWITCH =
  "smallcaps tracking-sc inline-flex min-h-10 items-center text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground/60";
const DOC =
  "text-base leading-7 text-foreground [&_a:hover]:decoration-brand [&_a]:text-brand [&_a]:underline [&_a]:decoration-brand/40 [&_a]:underline-offset-4";
const SECTION = "mt-10 border-t border-border pt-8";
const H2 = "flex items-baseline text-2xl font-medium";
const NUM = "smallcaps lining w-10 shrink-0 text-base font-normal text-muted-foreground";
const BODY = "mt-4 space-y-4 sm:pl-10";
const LEDGER = "lining divide-y divide-border border-y border-t-foreground/50";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[13rem_1fr] sm:items-baseline";
const LEDGER_TERM = "smallcaps tracking-sc text-sm text-muted-foreground";
const FOOTER_LINK = "inline-flex min-h-10 items-center hover:text-foreground";

export default function MentionsLegalesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      {/* The document header: the language switch in the top-right corner,
          then the centred name — eyebrow between rules, the title, a short
          rule, the dateline — over the double rule. */}
      <header className="mb-10">
        <div className="flex justify-end">
          <Link href={"/legal/en/notice" as Route} className={LANG_SWITCH}>
            English
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className={EYEBROW}>Document légal</p>
          <h1 className="letterpress mt-6 text-4xl font-medium sm:text-5xl">Mentions légales</h1>
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

      <footer className="rule-double smallcaps tracking-sc mt-16 flex flex-wrap items-center justify-center gap-x-3 pt-4 text-xs text-muted-foreground">
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
