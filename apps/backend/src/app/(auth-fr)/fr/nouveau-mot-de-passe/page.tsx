import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/form";

// French twin of /reset-password, where a reset link requested from
// /fr/mot-de-passe-oublie lands. Reached from an email only: not indexed.
export const metadata: Metadata = {
  title: { absolute: "Nouveau mot de passe — TwinMCP" },
  description: "Choisissez un nouveau mot de passe pour votre compte TwinMCP.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/fr/nouveau-mot-de-passe",
    languages: {
      en: "/reset-password",
      fr: "/fr/nouveau-mot-de-passe",
      "x-default": "/reset-password",
    },
  },
};

export default function FrResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm locale="fr" />
    </Suspense>
  );
}
