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
  title: "Privacy Policy",
  description: "How TwinMCP collects, uses, and protects your personal data. GDPR compliant.",
  alternates: {
    canonical: "/legal/en/privacy",
    languages: { en: "/legal/en/privacy", fr: "/legal/privacy" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "September 20, 2026";

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
const NOTE =
  "border border-l-2 border-info/40 border-l-info bg-info/10 px-4 py-3 text-sm text-info";
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

export default function PrivacyPageEn() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      {/* The document header: the language switch in the top-right corner,
          then the centred name — eyebrow between rules, the title, a short
          rule, the dateline — over the double rule. */}
      <header className="mb-10">
        <div className="flex justify-end">
          <Link href={"/legal/privacy" as Route} className={LANG_SWITCH}>
            Français
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className={EYEBROW}>Legal document</p>
          <h1 className="letterpress mt-6 text-4xl font-medium sm:text-5xl">Privacy Policy</h1>
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
            <Link href={"/legal/privacy" as Route}>French version</Link> is the authoritative text
            and prevails in case of any discrepancy.
          </p>
          <p>
            This policy explains what data TwinMCP collects, why, who it is shared with, and how to
            exercise your rights. It applies to the twinmcp.fr site, its APIs, and the hosted MCP
            server runtime service.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>1.</span> Data controller
          </h2>
          <div className={BODY}>
            <p>
              The data controller is the publisher of TwinMCP, whose full identity (name, legal
              form, address, company registration) is set out in the{" "}
              <Link href={"/legal/en/notice" as Route}>legal notice</Link>. It can be reached at{" "}
              <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>2.</span> Data we collect
          </h2>
          <div className={SUBSECTIONS}>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.1</span> Account and authentication
              </h3>
              <ul className={LIST}>
                <li>Email address (required)</li>
                <li>
                  Password (hashed, never stored in clear) or OAuth identifier (GitHub, Google)
                </li>
                <li>Unique user ID generated by Supabase Auth</li>
                <li>Account creation date, last sign-in date</li>
              </ul>
            </div>

            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.2</span> Billing
              </h3>
              <ul className={LIST}>
                <li>
                  Payment details (card, IBAN): processed and stored by Stripe. We never see full
                  card numbers.
                </li>
                <li>Plan, billing history, Stripe identifiers (customer, subscription)</li>
                <li>Billing address and VAT number if provided</li>
              </ul>
            </div>

            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.3</span> Service usage
              </h3>
              <ul className={LIST}>
                <li>MCP servers created, MCPs installed, associated configurations</li>
                <li>
                  API request audit logs (method, route, status code, timestamp, key identifier)
                </li>
                <li>
                  Request IP address: recorded in the audit logs (which you can view in your
                  dashboard) for security and abuse detection. Rate-limiting, in contrast, is
                  applied per account, not per IP.
                </li>
              </ul>
            </div>

            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>2.4</span> Analytics and monitoring
              </h3>
              <ul className={LIST}>
                <li>
                  Product events (PostHog): page views, clicks on the main buttons, sign-up funnel
                  steps
                </li>
                <li>Application errors (Sentry): stack traces, browser, URL</li>
                <li>Infrastructure metrics (Axiom): latency, HTTP codes, throughput</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Why we process this data
          </h2>
          <div className={BODY}>
            <Table className={LEDGER}>
              <TableHeader>
                <TableRow>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Legal basis (GDPR art. 6)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className={CELL}>
                    Providing the service (account, MCP runtime)
                  </TableCell>
                  <TableCell className={CELL}>Performance of the contract</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Billing and payment</TableCell>
                  <TableCell className={CELL}>
                    Performance of the contract + legal obligation (accounting)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Security, anti-abuse, rate-limiting</TableCell>
                  <TableCell className={CELL}>Legitimate interest</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Product analytics, service improvement</TableCell>
                  <TableCell className={CELL}>Legitimate interest (anonymized) / Consent</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>
                    Transactional emails (confirmation, alerts)
                  </TableCell>
                  <TableCell className={CELL}>Performance of the contract</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={CELL}>Newsletter or marketing emails</TableCell>
                  <TableCell className={CELL}>Consent (opt-in, unsubscribe at any time)</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>4.</span> Who we share with
          </h2>
          <div className={BODY}>
            <p>
              We have never sold and will never sell your data. It is shared only with the technical
              sub-processors needed to operate the service:
            </p>
            <Table className={LEDGER}>
              <TableHeader>
                <TableRow>
                  <TableHead>Sub-processor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Supabase</TableCell>
                  <TableCell className={CELL}>Database, authentication</TableCell>
                  <TableCell className={CELL}>EU / US (depending on chosen region)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Stripe</TableCell>
                  <TableCell className={CELL}>Payment processing</TableCell>
                  <TableCell className={CELL}>EU / US</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Upstash</TableCell>
                  <TableCell className={CELL}>Cache, rate-limiting, task queue</TableCell>
                  <TableCell className={CELL}>EU / US</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>OpenAI</TableCell>
                  <TableCell className={CELL}>
                    Generating embeddings for document indexing and search
                  </TableCell>
                  <TableCell className={CELL}>United States</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Resend</TableCell>
                  <TableCell className={CELL}>Sending transactional emails</TableCell>
                  <TableCell className={CELL}>EU</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Sentry</TableCell>
                  <TableCell className={CELL}>
                    Error monitoring (no cookie, no session recording)
                  </TableCell>
                  <TableCell className={CELL}>EU</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>PostHog</TableCell>
                  <TableCell className={CELL}>Product analytics</TableCell>
                  <TableCell className={CELL}>EU (EU region)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Axiom</TableCell>
                  <TableCell className={CELL}>Infrastructure logs</TableCell>
                  <TableCell className={CELL}>EU</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} font-medium`}>Site host</TableCell>
                  <TableCell className={CELL}>
                    Hosting of the application server (full identity in the legal notice)
                  </TableCell>
                  <TableCell className={CELL}>EU</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p>
              Where a transfer outside the EU is necessary, it is governed by the Standard
              Contractual Clauses (SCCs) approved by the European Commission.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>5.</span> Retention
          </h2>
          <div className={BODY}>
            <ul className={RULED}>
              <li>
                <strong>Active account:</strong> for as long as the account exists.
              </li>
              <li>
                <strong>Account deletion:</strong> immediate — account, servers, keys, and
                authentication identity are deleted. Audit logs kept for security and our legal
                obligations are anonymized (user identifier and IP address removed).
              </li>
              <li>
                <strong>Billing data:</strong> 10 years (French accounting obligation).
              </li>
              <li>
                <strong>Technical logs:</strong> 90 days.
              </li>
              <li>
                <strong>Analytics cookies:</strong> 13 months maximum.
              </li>
            </ul>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>6.</span> Cookies
          </h2>
          <div className={BODY}>
            <p>We use a minimal number of cookies:</p>
            <ul className={RULED}>
              <li>
                <strong>Supabase session</strong> (essential): keeps you signed in.
              </li>
              <li>
                <strong>PostHog</strong> (analytics): set only after your consent.
              </li>
              <li>
                <strong>Preferences</strong> (light/dark theme, language): stored in localStorage,
                never sent to the server.
              </li>
            </ul>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>7.</span> Your rights (GDPR)
          </h2>
          <div className={BODY}>
            <p>Under the General Data Protection Regulation, you have the following rights:</p>
            <ul className={RULED}>
              <li>
                <strong>Access:</strong> receive a copy of your data.
              </li>
              <li>
                <strong>Rectification:</strong> correct inaccurate data.
              </li>
              <li>
                <strong>Erasure:</strong> request deletion (&quot;right to be forgotten&quot;).
              </li>
              <li>
                <strong>Portability:</strong> receive your data in a structured format.
              </li>
              <li>
                <strong>Objection:</strong> object to processing based on our legitimate interest.
              </li>
              <li>
                <strong>Restriction:</strong> temporarily restrict processing.
              </li>
              <li>
                <strong>Complaint:</strong> lodge a complaint with the CNIL (French supervisory
                authority).
              </li>
            </ul>
            <p>
              You can exercise your right to erasure directly from{" "}
              <strong>Settings → Delete account</strong>: this deletes your account, servers, keys,
              and authentication identity, and anonymizes your audit logs. For the other rights
              (access, portability, rectification, objection, restriction), write to{" "}
              <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a> — we respond within 30 days.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>8.</span> Security
          </h2>
          <div className={BODY}>
            <p>
              We apply industry-standard technical and organizational measures: TLS encryption in
              transit, encryption at rest, password hashing (bcrypt via Supabase), Postgres RLS
              isolation, audit logs, and least-privilege access control.
            </p>
            <p>
              In the event of a data breach likely to result in a high risk to your rights and
              freedoms, we will notify you without undue delay (GDPR art. 34) and inform the CNIL
              within 72 hours (GDPR art. 33).
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>9.</span> Minors
          </h2>
          <div className={BODY}>
            <p>
              The service is not intended for minors. In France, processing the data of a child
              under 15 requires the consent of a holder of parental authority (art. 45 of the French
              Data Protection Act). We do not knowingly collect data concerning children under 15;
              if you believe this is the case, contact us for immediate deletion.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>10.</span> Changes to this policy
          </h2>
          <div className={BODY}>
            <p>
              This policy may change. Material changes are notified by email at least 30 days before
              they take effect. A version history is available on request.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>11.</span> Contact
          </h2>
          <div className={BODY}>
            <p>
              Any question about this policy: <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>
              .
            </p>
          </div>
        </section>
      </div>

      <footer className="rule-double smallcaps tracking-sc mt-16 flex flex-wrap items-center justify-center gap-x-3 pt-4 text-xs text-muted-foreground">
        <Link href={"/legal/en/terms" as Route} className={FOOTER_LINK}>
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Terms of Service
        </Link>
      </footer>
    </article>
  );
}
