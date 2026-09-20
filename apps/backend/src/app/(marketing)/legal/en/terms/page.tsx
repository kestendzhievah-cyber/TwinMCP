import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "TwinMCP terms of service — rights, obligations, billing, and termination.",
  alternates: {
    canonical: "/legal/en/terms",
    languages: { en: "/legal/en/terms", fr: "/legal/terms" },
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "September 20, 2026";

export default function TermsPageEn() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mb-12 border-b border-border/60 pb-8">
        <p className="flex items-center justify-between gap-4 text-xs uppercase tracking-wider text-muted-foreground">
          <span>Legal document</span>
          <Link
            href={"/legal/terms" as Route}
            className="normal-case underline hover:text-foreground"
          >
            Français
          </Link>
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_li]:text-sm [&_li]:text-muted-foreground">
        <section>
          <p>
            This is an English translation provided for convenience. The{" "}
            <Link href={"/legal/terms" as Route}>French version</Link> is the authoritative text and
            prevails in case of any discrepancy.
          </p>
          <p>
            Welcome to TwinMCP. By creating an account or using the service, you accept the terms
            below. If you do not agree, do not use the service.
          </p>
        </section>

        <h2>1. Definitions</h2>
        <p>
          <strong>&quot;Service&quot;</strong> means the TwinMCP platform available at twinmcp.fr,
          its APIs, and all associated subdomains. <strong>&quot;Account&quot;</strong> means the
          personal space created at sign-up. <strong>&quot;Content&quot;</strong> means the MCP
          servers, configurations, keys, and data you provide or generate through the Service.
        </p>

        <h2>2. Sign-up and account</h2>
        <p>
          You must be at least 16 years old (or the legal age of your jurisdiction) to create an
          account. The information provided at sign-up must be accurate. You are solely responsible
          for keeping your credentials confidential and for any activity on your account.
        </p>
        <p>
          We reserve the right to suspend or delete an account in the event of abusive, fraudulent,
          or non-compliant use.
        </p>

        <h2>3. Plans and billing</h2>
        <h3>3.1 Free plan</h3>
        <p>
          The Free plan is provided at no cost and without a credit card. It includes a limited
          quota described on the <Link href={"/plans" as Route}>pricing page</Link>. We may change
          these limits with 30 days&apos; notice.
        </p>
        <h3>3.2 Paid plans</h3>
        <p>
          Pro and Team subscriptions are billed monthly or annually via Stripe. Payment is due in
          advance and is non-refundable once the period has started, unless stated otherwise (see
          §3.3).
        </p>
        <h3>3.3 Refunds</h3>
        <p>
          You can request a full refund within 7 days of the initial subscription to a paid plan.
          After that, the plan remains active until the end of the paid period and no pro-rata
          refund is granted.
        </p>
        <h3>3.4 Price changes</h3>
        <p>
          Any change in pricing applies from the next billing period, with a minimum of 30
          days&apos; notice.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            host or distribute illegal or malicious content, or content infringing third-party
            rights;
          </li>
          <li>circumvent the quotas, rate limits, or security mechanisms of the Service;</li>
          <li>use the Service to attack, scan, or overload third-party systems;</li>
          <li>resell or redistribute access to the Service without written authorization;</li>
          <li>attempt to reverse-engineer, disassemble, or clone the Service.</li>
        </ul>

        <h2>5. Intellectual property</h2>
        <p>
          You retain ownership of your Content. You grant us a non-exclusive, worldwide, limited
          license necessary to host, process, and deliver your Content through the Service.
        </p>
        <p>The TwinMCP source code, trademarks, and design remain our exclusive property.</p>

        <h2>6. Availability and SLA</h2>
        <p>
          We target 99.9% availability on the Pro and Team plans. No contractual SLA is guaranteed
          on the Free plan. Planned maintenance is announced at least 24 hours in advance.
        </p>

        <h2>7. Termination</h2>
        <p>
          You can terminate your account at any time from the Billing tab of the dashboard.
          Termination takes effect at the end of the current billing period. You can also delete
          your account and all associated data immediately from{" "}
          <strong>Settings → Delete account</strong>.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          The Service is provided &quot;as is&quot;. To the extent permitted by law, our total
          liability may not exceed the amount you paid over the last 12 months. We are not liable
          for indirect losses (data loss, loss of profit, business interruption).
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update these terms. Material changes are notified by email at least 30 days before
          they take effect. Continuing to use the Service after that date constitutes acceptance.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These terms are governed by French law. Any dispute will be submitted to the competent
          courts, subject to mandatory consumer-protection provisions.
        </p>

        <h2>11. Contact</h2>
        <p>
          For any question, write to <a href="mailto:hello@twinmcp.fr">hello@twinmcp.fr</a>.
        </p>
      </div>

      <footer className="mt-16 border-t border-border/60 pt-6 text-xs text-muted-foreground">
        <Link href={"/legal/en/privacy" as Route} className="hover:text-foreground">
          Privacy Policy →
        </Link>
      </footer>
    </article>
  );
}
