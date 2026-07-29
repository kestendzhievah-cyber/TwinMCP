import type { Metadata } from "next";
import { ContactSalesForm } from "./contact-form";

export const metadata: Metadata = {
  title: "TwinMCP Enterprise — Talk to sales",
  description:
    "TwinMCP Enterprise: SSO/SAML, private deployment, custom audit retention, dedicated support, and a custom SLA. Tell us about your organization.",
  alternates: { canonical: "/enterprise" },
};

export default function EnterprisePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">TwinMCP Enterprise</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          SSO/SAML, private deployment, custom audit retention, a dedicated Slack channel, and a
          custom SLA. Need self-serve for a smaller team? The{" "}
          <a href="/plans" className="underline underline-offset-2">
            Team plan
          </a>{" "}
          starts at €99/mo. Otherwise, tell us about your organization and we&apos;ll get back to
          you fast.
        </p>
      </div>
      <ContactSalesForm />
    </div>
  );
}
