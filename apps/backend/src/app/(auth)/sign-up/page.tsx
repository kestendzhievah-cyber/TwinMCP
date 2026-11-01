import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SIGNUP_OFFER } from "@/components/pricing/wallet-copy";
import { SignUpForm } from "./form";

// Conversion page — keep it indexable, but give it a unique title/description so
// it isn't a duplicate of the root default.
export const metadata: Metadata = {
  title: "Get started free — TwinMCP",
  description: `Create your TwinMCP account and run your first MCP server in about 2 minutes. ${SIGNUP_OFFER.en}.`,
  // Reciprocal hreflang with /fr/inscription (Google ignores one-way pairs).
  alternates: {
    canonical: "/sign-up",
    languages: { en: "/sign-up", fr: "/fr/inscription", "x-default": "/sign-up" },
  },
};

export default function SignUpPage() {
  return (
    <AuthShell locale="en" panel="offer">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
