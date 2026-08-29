import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "./form";

// Conversion page — keep it indexable, but give it a unique title/description so
// it isn't a duplicate of the root default.
export const metadata: Metadata = {
  title: "Get started free — TwinMCP",
  description:
    "Create your TwinMCP account and run your first MCP server in 2 minutes. Free tier — no credit card required.",
  alternates: { canonical: "/sign-up" },
};

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
