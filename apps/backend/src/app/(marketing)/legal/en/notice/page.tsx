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

export default function LegalNoticePageEn() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mb-12 border-b border-border/60 pb-8">
        <p className="flex items-center justify-between gap-4 text-xs uppercase tracking-wider text-muted-foreground">
          <span>Legal document</span>
          <Link
            href={"/legal/mentions-legales" as Route}
            className="normal-case underline hover:text-foreground"
          >
            Français
          </Link>
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Legal Notice</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-sm [&_li]:text-muted-foreground [&_dt]:text-sm [&_dt]:font-medium [&_dt]:text-foreground [&_dd]:text-sm [&_dd]:text-muted-foreground">
        <section>
          <p>
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

        <h2>1. Site publisher</h2>
        <dl>
          <dt>Name</dt>
          <dd>{EDITEUR.denomination}</dd>
          <dt>Legal form</dt>
          <dd>{EDITEUR.formeJuridique}</dd>
          <dt>Address</dt>
          <dd>{EDITEUR.adresse}</dd>
          <dt>Company registration (SIREN / SIRET)</dt>
          <dd>{EDITEUR.siren}</dd>
          <dt>Intra-EU VAT number</dt>
          <dd>{EDITEUR.tva}</dd>
          <dt>Contact</dt>
          <dd>
            <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>
          </dd>
        </dl>

        <h2>2. Publication director</h2>
        <p>{EDITEUR.directeurPublication}</p>

        <h2>3. Host</h2>
        <dl>
          <dt>Name</dt>
          <dd>{HEBERGEUR.nom}</dd>
          <dt>Address</dt>
          <dd>{HEBERGEUR.adresse}</dd>
          <dt>Phone</dt>
          <dd>{HEBERGEUR.telephone}</dd>
        </dl>

        <h2>4. Intellectual property</h2>
        <p>
          Unless otherwise stated, all content on the site (text, graphics, logo, code) is the
          property of the publisher or used under license. Any reproduction or representation, in
          whole or in part, without prior authorization, is prohibited. Third-party trademarks and
          logos cited remain the property of their respective owners.
        </p>

        <h2>5. Personal data</h2>
        <p>
          The processing of your personal data is described in our{" "}
          <Link href={"/legal/en/privacy" as Route}>privacy policy</Link>, which sets out the
          purposes, legal bases, retention periods, and how to exercise your rights (access,
          rectification, erasure, portability, objection, restriction) as well as your right to
          lodge a complaint with the CNIL.
        </p>

        <h2>6. Contact</h2>
        <p>
          For any question about the site or this notice:{" "}
          <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
        </p>
      </div>

      <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
        <Link href={"/legal/en/privacy" as Route} className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href={"/legal/en/terms" as Route} className="hover:text-foreground">
          Terms of Service
        </Link>
      </footer>
    </article>
  );
}
