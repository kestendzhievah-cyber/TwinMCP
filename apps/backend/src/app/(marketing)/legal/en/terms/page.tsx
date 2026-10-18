import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "TwinMCP terms of service — rights, obligations, billing, and termination.",
  alternates: {
    canonical: "/legal/en/terms",
    languages: { en: "/legal/en/terms", fr: "/legal/terms" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "October 13, 2026";

// Typeset as a document on the card stock (docs/DESIGN.md §4–5): a centred
// header over the double rule, numbered sections with hanging small-caps
// numerals, the definitions as a hairline ledger, pinstripe links.
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
const SUBSECTION = "space-y-4";
const H3 = "flex items-baseline text-xl font-medium sm:-ml-10";
const SUBNUM = "smallcaps lining w-10 shrink-0 text-sm font-normal text-muted-foreground";
const LEDGER = "divide-y divide-border border-y border-t-foreground/50";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8rem_1fr] sm:items-baseline";
const LIST = "list-disc space-y-2 pl-6 marker:text-muted-foreground";
const MODEL = "border-l-2 border-foreground/40 pl-5 text-foreground/80";
const FOOTER_LINK = "inline-flex min-h-10 items-center gap-2 hover:text-foreground";

export default function TermsPageEn() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      {/* The document header: the language switch in the top-right corner,
          then the centred name — eyebrow between rules, the title, a short
          rule, the dateline — over the double rule. */}
      <header className="mb-10">
        <div className="flex justify-end">
          <Link href={"/legal/terms" as Route} className={LANG_SWITCH}>
            Français
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className={EYEBROW}>Legal document</p>
          <h1 className="letterpress mt-6 text-4xl font-medium sm:text-5xl">Terms of Service</h1>
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
            <Link href={"/legal/terms" as Route}>French version</Link> is the authoritative text and
            prevails in case of any discrepancy.
          </p>
          <p>
            Welcome to TwinMCP. By creating an account or using the service, you accept the terms
            below. If you do not agree, do not use the service.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>1.</span> Definitions
          </h2>
          <div className={BODY}>
            <dl className={LEDGER}>
              <div className={LEDGER_ROW}>
                <dt>
                  <strong>&quot;Service&quot;</strong>
                </dt>
                <dd>
                  means the TwinMCP platform available at twinmcp.fr, its APIs, and all associated
                  subdomains.
                </dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt>
                  <strong>&quot;Account&quot;</strong>
                </dt>
                <dd>means the personal space created at sign-up.</dd>
              </div>
              <div className={LEDGER_ROW}>
                <dt>
                  <strong>&quot;Content&quot;</strong>
                </dt>
                <dd>
                  means the MCP servers, configurations, keys, and data you provide or generate
                  through the Service.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>2.</span> Sign-up and account
          </h2>
          <div className={BODY}>
            <p>
              You must be at least 16 years old (or the legal age of your jurisdiction) to create an
              account. The information provided at sign-up must be accurate. You are solely
              responsible for keeping your credentials confidential and for any activity on your
              account.
            </p>
            <p>
              We reserve the right to suspend or delete an account in the event of abusive,
              fraudulent, or non-compliant use.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Plans and billing
          </h2>
          <div className={SUBSECTIONS}>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.1</span> Free plan
              </h3>
              <p>
                The Free plan is provided at no cost and without a credit card. It includes a
                limited quota described on the <Link href={"/plans" as Route}>pricing page</Link>.
                We may change these limits with 30 days&apos; notice.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.2</span> Paid plans
              </h3>
              <p>
                Pro and Team subscriptions are billed monthly or annually via Stripe. Payment is due
                in advance and is non-refundable once the period has started, unless stated
                otherwise (see §3.3 and, for consumers, §3.5).
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.3</span> Refunds (commercial guarantee)
              </h3>
              <p>
                You can request a full refund within 7 days of the initial subscription to a paid
                plan. After that, the plan remains active until the end of the paid period and no
                pro-rata refund is granted. This commercial guarantee is in addition to the
                statutory right of withdrawal for consumers (§3.5) and does not replace it.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.4</span> Price changes
              </h3>
              <p>
                Any change in pricing applies from the next billing period, with a minimum of 30
                days&apos; notice.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.5</span> Right of withdrawal (consumers)
              </h3>
              <p>
                If you are a consumer, you have <strong>14 days</strong> from subscribing to a paid
                plan to withdraw from the contract without giving any reason (articles L221-18 et
                seq. of the French Consumer Code, implementing Directive 2011/83/EU).
              </p>
              <p>
                By subscribing, you <strong>expressly request</strong> that the Service be provided
                to you immediately, without waiting for the withdrawal period to expire. If you
                withdraw after performance has begun, you remain liable for the price of the service
                already provided up to the notification of your withdrawal, calculated pro rata; the
                balance is refunded within 14 days to the payment method you used (article L221-25).
              </p>
              <p>
                To exercise this right, send an unambiguous statement to{" "}
                <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a> from the email address
                associated with your account. You may use the following model (not mandatory):
              </p>
              <p className={MODEL}>
                <em>
                  “I hereby give notice that I withdraw from the contract for the TwinMCP
                  subscription taken out on [subscription date]. Name: [your name]. Account email:
                  [email]. Date: [today&apos;s date].”
                </em>
              </p>
            </div>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>4.</span> Acceptable use
          </h2>
          <div className={BODY}>
            <p>You agree not to:</p>
            <ul className={LIST}>
              <li>
                host or distribute illegal or malicious content, or content infringing third-party
                rights;
              </li>
              <li>circumvent the quotas, rate limits, or security mechanisms of the Service;</li>
              <li>use the Service to attack, scan, or overload third-party systems;</li>
              <li>resell or redistribute access to the Service without written authorization;</li>
              <li>attempt to reverse-engineer, disassemble, or clone the Service.</li>
            </ul>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>5.</span> Intellectual property
          </h2>
          <div className={BODY}>
            <p>
              You retain ownership of your Content. You grant us a non-exclusive, worldwide, limited
              license necessary to host, process, and deliver your Content through the Service.
            </p>
            <p>The TwinMCP source code, trademarks, and design remain our exclusive property.</p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>6.</span> Availability and SLA
          </h2>
          <div className={BODY}>
            <p>
              We target 99.9% availability on the Pro and Team plans. No contractual SLA is
              guaranteed on the Free plan. Planned maintenance is announced at least 24 hours in
              advance.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>7.</span> Termination
          </h2>
          <div className={BODY}>
            <p>
              You can terminate your account at any time from the Billing tab of the dashboard.
              Termination takes effect at the end of the current billing period. You can also delete
              your account and all associated data immediately from{" "}
              <strong>Settings → Delete account</strong>.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>8.</span> Limitation of liability
          </h2>
          <div className={BODY}>
            <p>
              The Service is provided &quot;as is&quot;. To the extent permitted by law, our total
              liability may not exceed the amount you paid over the last 12 months. We are not
              liable for indirect losses (data loss, loss of profit, business interruption).
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>9.</span> Changes
          </h2>
          <div className={BODY}>
            <p>
              We may update these terms. Material changes are notified by email at least 30 days
              before they take effect. Continuing to use the Service after that date constitutes
              acceptance.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>10.</span> Governing law
          </h2>
          <div className={BODY}>
            <p>
              These terms are governed by French law. Any dispute will be submitted to the competent
              courts, subject to mandatory consumer-protection provisions.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>11.</span> Contact
          </h2>
          <div className={BODY}>
            <p>
              For any question, write to <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>.
            </p>
          </div>
        </section>
      </div>

      <footer className="rule-double smallcaps tracking-sc mt-16 flex flex-wrap items-center justify-center gap-x-3 pt-4 text-xs text-muted-foreground">
        <Link href={"/legal/en/privacy" as Route} className={FOOTER_LINK}>
          Privacy Policy
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </article>
  );
}
