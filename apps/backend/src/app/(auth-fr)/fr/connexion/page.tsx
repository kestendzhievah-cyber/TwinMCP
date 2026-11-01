import type { Metadata } from "next";
import { getOAuthProviders } from "@/lib/auth/oauth-providers";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
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

export default async function FrSignInPage() {
  // The Google button shows once the provider is enabled in Supabase.
  const { google } = await getOAuthProviders();
  return (
    <AuthShell locale="fr">
      <Suspense>
        <SignInForm locale="fr" googleEnabled={google} />
      </Suspense>
    </AuthShell>
  );
}
