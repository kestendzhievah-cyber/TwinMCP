import type { Metadata } from "next";
import { ContactSalesForm } from "./contact-form";

export const metadata: Metadata = {
  title: "TwinMCP for teams — Contact us",
  description:
    "TwinMCP Team plan for companies: unlimited MCP servers, member management, and priority support, priced for your team size. Tell us about your team.",
  alternates: { canonical: "/enterprise" },
};

export default function EnterprisePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">TwinMCP for teams</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Unlimited MCP servers, shared MCPs, member management, and priority support — priced for
          your team size. Tell us a bit about you and we&apos;ll get back to you fast.
        </p>
      </div>
      <ContactSalesForm />
    </div>
  );
}
