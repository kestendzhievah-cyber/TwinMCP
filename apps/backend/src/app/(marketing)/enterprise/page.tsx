import type { Metadata } from "next";
import { ContactSalesForm } from "./contact-form";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "TwinMCP Enterprise — Talk to sales",
  description:
    "TwinMCP Enterprise: SSO/SAML, private deployment, custom audit retention, dedicated support, and a custom SLA. Tell us about your organization.",
  alternates: { canonical: "/enterprise" },
};

export default function EnterprisePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Enterprise", url: "/enterprise" },
        ])}
      />
      {/* The centred name: eyebrow between rules, engraved title, a short rule, the lead. */}
      <div className="mb-12 text-center md:mb-16">
        <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
          Talk to sales
        </p>
        <h1 className="display letterpress mt-6 text-4xl sm:text-5xl md:text-6xl">
          TwinMCP Enterprise
        </h1>
        <div className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          SSO/SAML, private deployment, custom audit retention, a dedicated Slack channel, and a
          custom SLA. Need self-serve for a smaller team? The{" "}
          <a
            href="/plans"
            className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
          >
            Team plan
          </a>{" "}
          starts at <span className="lining">€99/mo</span>. Otherwise, tell us about your
          organization and we&apos;ll get back to you fast.
        </p>
      </div>
      <ContactSalesForm />
    </div>
  );
}
