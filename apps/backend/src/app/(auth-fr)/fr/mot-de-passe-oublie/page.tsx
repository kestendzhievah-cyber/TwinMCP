import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/form";

// French twin of /forgot-password: kept out of the index, reciprocal hreflang.
export const metadata: Metadata = {
  title: { absolute: "Mot de passe oublié — TwinMCP" },
  description: "Recevez un lien pour choisir un nouveau mot de passe TwinMCP.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/fr/mot-de-passe-oublie",
    languages: {
      en: "/forgot-password",
      fr: "/fr/mot-de-passe-oublie",
      "x-default": "/forgot-password",
    },
  },
};

export default function FrForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm locale="fr" />
    </Suspense>
  );
}
