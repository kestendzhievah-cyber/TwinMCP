import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./form";

// Reached from a reset email only: kept out of the index. The hreflang pair
// with /fr/nouveau-mot-de-passe is reciprocal.
export const metadata: Metadata = {
  title: { absolute: "Choose a new password — TwinMCP" },
  description: "Choose a new password for your TwinMCP account.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/reset-password",
    languages: {
      en: "/reset-password",
      fr: "/fr/nouveau-mot-de-passe",
      "x-default": "/reset-password",
    },
  },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell locale="en">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
