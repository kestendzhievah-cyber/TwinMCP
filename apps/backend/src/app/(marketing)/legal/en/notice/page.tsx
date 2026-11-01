import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
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

// A legal document in the "Clear sky" style (docs/DESIGN.md): a plain header,
// the text on one white card, numbered sections with brand numerals, the
// identity details and lists as rounded ledgers, underlined blue links.
const EYEBROW = "eyebrow";
const LANG_SWITCH =
  "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent";
const DOC =
  "rounded-2xl border border-border bg-card p-5 text-base leading-7 text-foreground shadow-sm sm:p-10 [&_a:hover]:decoration-2 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4";
const NOTE = "rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info";
const SECTION = "mt-10 border-t border-border pt-8";
const H2 = "flex items-baseline font-display text-xl font-bold tracking-tight sm:text-2xl";
const NUM = "w-10 shrink-0 text-base font-semibold tabular-nums text-brand";
const BODY = "mt-4 space-y-4 sm:pl-10";
const LEDGER = "divide-y divide-border rounded-xl border border-border tabular-nums";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:items-baseline";
const LEDGER_TERM = "text-sm font-medium text-muted-foreground";
const FOOTER_LINK =
  "inline-flex min-h-10 items-center gap-2 font-medium text-brand underline-offset-4 hover:underline";

export default function LegalNoticePageEn() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-20">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <p className={EYEBROW}>Legal document</p>
          <Link href={"/legal/mentions-legales" as Route} className={LANG_SWITCH}>
            Français
          </Link>
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Legal Notice
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
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

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 text-sm text-muted-foreground">
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
