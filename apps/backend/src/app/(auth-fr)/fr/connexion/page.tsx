import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/app/(auth)/sign-in/form";

// French twin of /sign-in. Like the English page: no SEO value, kept out of the
// index; the hreflang pair with /sign-in is reciprocal.
export const metadata: Metadata = {
  title: { absolute: "Connexion — TwinMCP" },
  description: "Connectez-vous à votre tableau de bord TwinMCP pour gérer vos serveurs MCP.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/fr/connexion",
    languages: { en: "/sign-in", fr: "/fr/connexion", "x-default": "/sign-in" },
  },
};

export default function FrSignInPage() {
  return (
    <Suspense>
      <SignInForm locale="fr" />
    </Suspense>
  );
}
