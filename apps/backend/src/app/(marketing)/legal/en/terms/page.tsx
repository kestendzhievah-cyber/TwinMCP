import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { walletFacts } from "@/components/pricing/wallet-copy";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "TwinMCP terms of service — rights, obligations, billing, and termination.",
  alternates: {
    canonical: "/legal/en/terms",
    languages: { en: "/legal/en/terms", fr: "/legal/terms" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "October 29, 2026";

// Amounts quoted in §3, from the wallet price list (lib/wallet/pricing.ts).
const W = walletFacts("en");
const SIGNUP_CREDIT = W.signupCredit;
const SIGNUP_DAYS = W.signupDays;
const MIN_TOPUP = W.minTopup;
const MAX_TOPUP = W.maxTopup;
const OVERDRAFT = W.overdraft;

// A legal document in the "Clear sky" style (docs/DESIGN.md): a plain header,
// the text on one white card, numbered sections with brand numerals, the
// identity details and lists as rounded ledgers, underlined blue links.
const EYEBROW = "eyebrow";
const LANG_SWITCH =
  "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent";
const DOC =
  "rounded-2xl border border-border bg-card p-5 text-base leading-7 text-foreground shadow-sm sm:p-10 [&_a:hover]:decoration-2 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-foreground";
const NOTE = "rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info";
const SECTION = "mt-10 border-t border-border pt-8";
const H2 = "flex items-baseline font-display text-xl font-bold tracking-tight sm:text-2xl";
const NUM = "w-10 shrink-0 text-base font-semibold tabular-nums text-brand";
const BODY = "mt-4 space-y-4 sm:pl-10";
const SUBSECTIONS = "mt-6 space-y-8 sm:pl-10";
const SUBSECTION = "space-y-4";
const H3 = "flex items-baseline font-display text-lg font-semibold tracking-tight sm:-ml-10";
const SUBNUM = "w-10 shrink-0 text-sm font-semibold tabular-nums text-brand";
const LEDGER = "divide-y divide-border rounded-xl border border-border tabular-nums";
const LEDGER_ROW = "grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:items-baseline";
const LIST = "list-disc space-y-2 pl-6 marker:text-muted-foreground";
const MODEL = "rounded-r-lg border-l-4 border-border bg-surface-alt py-3 pl-5 pr-4 text-foreground";
const FOOTER_LINK =
  "inline-flex min-h-10 items-center gap-2 font-medium text-brand underline-offset-4 hover:underline";

export default function TermsPageEn() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-20">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <p className={EYEBROW}>Legal document</p>
          <Link href={"/legal/terms" as Route} className={LANG_SWITCH}>
            Français
          </Link>
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
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

        {/* TODO(legal-review, 2026-10-29): §3 was rewritten for the prepaid wallet
            (no subscription, promotional sign-up credit, paid top-ups, auto-recharge,
            subscription conversion). Every paragraph of §3 needs review by counsel,
            and the owner must confirm: paid-credit refund on account closure, VAT
            treatment of top-ups (single-purpose voucher) and of the promotional
            credit, and the withdrawal flow under ordonnance n° 2026-2. */}
        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>3.</span> Prepaid credit and payment
          </h2>
          <div className={SUBSECTIONS}>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.1</span> Prepaid credit
              </h3>
              <p>
                The Service is paid for from a prepaid balance in euros (the{" "}
                <strong>“credit”</strong>) attached to your Account. There is no subscription and
                nothing renews. Your use of the Service (tool calls and compute time, as listed on
                the <Link href={"/plans" as Route}>pricing page</Link>) is deducted from your credit
                at the prices in force when the use takes place.
              </p>
              <p>
                When your credit reaches zero, the Service stops processing billable requests and
                your servers are paused. Compute already running at that moment may take your
                balance slightly below zero, by no more than {OVERDRAFT}; that amount is deducted
                from your next top-up. We never charge your payment method for it unless you turned
                on auto-recharge (§3.3).
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.2</span> Promotional sign-up credit
              </h3>
              <p>
                A new Account may receive {SIGNUP_CREDIT} of promotional credit, without payment or
                card, valid for {SIGNUP_DAYS} days from sign-up, at most once per person.
                Promotional credit is a discount on the Service: it has{" "}
                <strong>no cash value</strong> and is <strong>non-refundable</strong>,{" "}
                <strong>non-transferable</strong> and cannot be exchanged. It is used before any
                paid credit, and any part left unused at the end of its validity expires. Until the
                first paid top-up, it can only be used within the limits shown on the pricing page
                (one small server; some MCPs that run code or a browser are excluded). We may refuse
                or cancel promotional credit obtained through several accounts, disposable email
                addresses or any other abuse.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.3</span> Top-ups, payment and auto-recharge
              </h3>
              <p>
                You buy paid credit by topping up your balance by card through Stripe, from{" "}
                {MIN_TOPUP} to {MAX_TOPUP} per top-up. The amount, and any VAT that applies, is
                shown before you pay; the credit is added once the payment is confirmed.
              </p>
              <p>
                Auto-recharge is optional and off by default. If you turn it on, you authorise us to
                charge the card you saved for the top-up amount you chose whenever your balance
                falls below the threshold you chose, without exceeding the monthly cap you set. You
                can change or turn off auto-recharge at any time from your billing page.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.4</span> Validity of paid credit and refunds
              </h3>
              <p>
                Paid credit has no expiry date: it remains available while your Account is open.
                Except where the law requires otherwise, in particular the right of withdrawal
                (§3.6), credit that has been used is not refundable.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.5</span> Price changes
              </h3>
              <p>
                We may change our prices with at least 30 days&apos; notice. New prices apply only
                to use that takes place after they come into force; credit already bought keeps its
                value in euros.
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.6</span> Right of withdrawal (consumers)
              </h3>
              <p>
                If you are a consumer, you have <strong>14 days</strong> from each paid top-up to
                withdraw from that purchase without giving any reason (articles L221-18 et seq. of
                the French Consumer Code, implementing Directive 2011/83/EU).
              </p>
              <p>
                When you top up, you <strong>expressly request</strong> that the credit be usable
                immediately, before the withdrawal period ends. If you withdraw, the part of that
                top-up you have not used is refunded within 14 days to the payment method you used;
                the part already used to provide the Service remains due (article L221-25).
              </p>
              <p>
                To exercise this right, send an unambiguous statement to{" "}
                <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a> from the email address
                associated with your account. You may use the following model (not mandatory):
              </p>
              <p className={MODEL}>
                <em>
                  “I hereby give notice that I withdraw from my TwinMCP credit top-up of [date of
                  the top-up]. Name: [your name]. Account email: [email]. Date: [today&apos;s
                  date].”
                </em>
              </p>
            </div>
            <div className={SUBSECTION}>
              <h3 className={H3}>
                <span className={SUBNUM}>3.7</span> Former subscriptions
              </h3>
              <p>
                Pro and Team subscriptions taken out before 29 October 2026 are converted to credit:
                the unused part of the current paid period is added to your balance as paid credit,
                the subscription is cancelled so that it no longer renews, and you are informed by
                email of the amounts.
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
              {/* TODO(legal-review, 2026-10-29): availability wording updated for the
                  removal of plans. */}
              We target 99.9% availability for accounts funded by a paid top-up. No contractual SLA
              is guaranteed, in particular for accounts using only promotional credit. Planned
              maintenance is announced at least 24 hours in advance.
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>
            <span className={NUM}>7.</span> Closing your account
          </h2>
          {/* TODO(legal-review, 2026-10-29): §7 rewritten for prepaid credit (no
              subscription to cancel). What happens to unused paid credit at closure
              (refund) is still to be confirmed with the lawyer (§3.4). */}
          <div className={BODY}>
            <p>
              There is no subscription to cancel. You can close your Account at any time from{" "}
              <strong>Settings → Delete account</strong>. Closure is immediate and deletes the
              associated data, except the accounting records (top-ups, invoices) the law requires us
              to keep.
            </p>
            <p>
              While paid credit remains on your Account, closure is done by writing to{" "}
              <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>, so that this credit can be
              settled first (§3.4). Unused promotional credit is lost at closure.
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

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 text-sm text-muted-foreground">
        <Link href={"/legal/en/privacy" as Route} className={FOOTER_LINK}>
          Privacy Policy
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </article>
  );
}
