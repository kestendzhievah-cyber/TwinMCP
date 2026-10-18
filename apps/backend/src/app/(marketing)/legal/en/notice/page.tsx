import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Separator } from "@/components/ui/separator";
import { EDITEUR, HEBERGEUR } from "@/lib/legal/entity";

export const metadata: Metadata = {
  title: "Legal Notice",
  description:
    "TwinMCP legal notice: publisher, publication director, host, and contact, as required by the French Confidence in the Digital Economy Act (LCEN).",
  alternates: {
    canonical: "/legal/en/notice",
    languages: { en: "/legal/en/notice", fr: "/legal/mentions-legales" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "September 20, 2026";

// Typeset as a document on the card stock (docs/DESIGN.md §4–5): a centred
// header over the double rule, numbered sections with hanging small-caps
// numerals, the identity details as hairline ledgers, pinstripe links.
const EYEBROW =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']";
const LANG_SWITCH =
  "smallcaps tracking-sc inline-flex min-h-10 items-center text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground/60";
const DOC =
  "text-base leading-7 text-foreground [&_a:hover]:decoration-brand [&_a]:text-brand [&_a]:underline [&_a]:decoration-brand/40 [&_a]:underline-offset-4";
const NOTE =
  "border border-l-2 border-info/40 border-l-info bg-info/10 px-4 py-3 text-sm text-info";
const SECTION = "mt-10 border-t border-border pt-8";
const H2 = "flex items-baseline text-2xl font-medium";
const NUM = "smallcaps lining w-10 shrink-0 text-base font-normal text-muted-foreground";
const BODY = "mt-4 space-y-4 sm:pl-10";
const LEDGER = "lining divide-y divide-border border-y border-t-foreground/50";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[13rem_1fr] sm:items-baseline";
const LEDGER_TERM = "smallcaps tracking-sc text-sm text-muted-foreground";
const FOOTER_LINK = "inline-flex min-h-10 items-center hover:text-foreground";

export default function LegalNoticePageEn() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      {/* The document header: the language switch in the top-right corner,
          then the centred name — eyebrow between rules, the title, a short
          rule, the dateline — over the double rule. */}
      <header className="mb-10">
        <div className="flex justify-end">
          <Link href={"/legal/mentions-legales" as Route} className={LANG_SWITCH}>
            Français
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className={EYEBROW}>Legal document</p>
          <h1 className="letterpress mt-6 text-4xl font-medium sm:text-5xl">Legal Notice</h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
          <p className="lining mt-6 text-sm italic text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
        <Separator variant="double" className="mt-10" />
      </header>

      <div className={DOC}>
        <section className="space-y-4">
          <p className={NOTE}>
            This is an English translation provided for convenience. The{" "}
            <Link href={"/legal/mentions-legales" as Route}>French version</Link> is the
            authoritative text and prevails in case of any discrepancy.
          </p>
          <p>
            In accordance with article 6-III of French Act No. 2004-575 of 21 June 2004 on
            Confidence in the Digital Economy (LCEN), the following information is provided to users
            of the twinmcp.fr site.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>1.</span> Site publisher
          </h2>
          <div className={BODY}>
            <dl className={LEDGER}>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Name</dt>
                <dd>{EDITEUR.denomination}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Legal form</dt>
                <dd>{EDITEUR.formeJuridique}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Address</dt>
                <dd>{EDITEUR.adresse}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>
                  Registration number (EIK — Bulgarian Commercial Register)
                </dt>
                <dd>{EDITEUR.immatriculation}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Share capital</dt>
                <dd>{EDITEUR.capital}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Intra-EU VAT number</dt>
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
            <span className={NUM}>2.</span> Publication director
          </h2>
          <div className={BODY}>
            <p>{EDITEUR.directeurPublication}</p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Host
          </h2>
          <div className={BODY}>
            <dl className={LEDGER}>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Name</dt>
                <dd>{HEBERGEUR.nom}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Address</dt>
                <dd>{HEBERGEUR.adresse}</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt className={LEDGER_TERM}>Phone</dt>
                <dd>{HEBERGEUR.telephone}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>4.</span> Intellectual property
          </h2>
          <div className={BODY}>
            <p>
              Unless otherwise stated, all content on the site (text, graphics, logo, code) is the
              property of the publisher or used under license. Any reproduction or representation,
              in whole or in part, without prior authorization, is prohibited. Third-party
              trademarks and logos cited remain the property of their respective owners.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>5.</span> Personal data
          </h2>
          <div className={BODY}>
            <p>
              The processing of your personal data is described in our{" "}
              <Link href={"/legal/en/privacy" as Route}>privacy policy</Link>, which sets out the
              purposes, legal bases, retention periods, and how to exercise your rights (access,
              rectification, erasure, portability, objection, restriction) as well as your right to
              lodge a complaint with the CNIL.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>6.</span> Contact
          </h2>
          <div className={BODY}>
            <p>
              For any question about the site or this notice:{" "}
              <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
            </p>
          </div>
        </section>
      </div>

      <footer className="rule-double smallcaps tracking-sc mt-16 flex flex-wrap items-center justify-center gap-x-3 pt-4 text-xs text-muted-foreground">
        <Link href={"/legal/en/privacy" as Route} className={FOOTER_LINK}>
          Privacy Policy
        </Link>
        <span aria-hidden>·</span>
        <Link href={"/legal/en/terms" as Route} className={FOOTER_LINK}>
          Terms of Service
        </Link>
      </footer>
    </article>
  );
}
