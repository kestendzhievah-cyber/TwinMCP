import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./form";

// Utility screen: no SEO value, kept out of the index. The hreflang pair with
// the French twin stays reciprocal (/fr/mot-de-passe-oublie lists this page).
export const metadata: Metadata = {
  title: { absolute: "Reset your password — TwinMCP" },
  description: "Request a link to choose a new TwinMCP password.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/forgot-password",
    languages: {
      en: "/forgot-password",
      fr: "/fr/mot-de-passe-oublie",
      "x-default": "/forgot-password",
    },
  },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell locale="en">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
