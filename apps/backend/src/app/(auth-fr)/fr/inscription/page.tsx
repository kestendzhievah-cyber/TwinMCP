import type { Metadata } from "next";
import { getOAuthProviders } from "@/lib/auth/oauth-providers";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SIGNUP_OFFER } from "@/components/pricing/wallet-copy";
import { SignUpForm } from "@/app/(auth)/sign-up/form";

// French twin of /sign-up — the landing for French ads ("Démarrer gratuitement").
// Indexable like the English page, with its own title/description and canonical.
export const metadata: Metadata = {
  title: { absolute: "Créer un compte gratuit — TwinMCP" },
  description: `Créez votre compte TwinMCP et lancez votre premier serveur MCP en 2 minutes environ. ${SIGNUP_OFFER.fr}.`,
  alternates: {
    canonical: "/fr/inscription",
    languages: { en: "/sign-up", fr: "/fr/inscription", "x-default": "/sign-up" },
  },
  // Its own share card (WhatsApp, LinkedIn, Slack) instead of the root English
  // one. Images still come from the root opengraph-image / twitter-image files.
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: "/fr/inscription",
    title: "Créer un compte gratuit — TwinMCP",
    description: `Lancez votre premier serveur MCP en 2 minutes environ. ${SIGNUP_OFFER.fr}.`,
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Créer un compte gratuit — TwinMCP",
    description: `Lancez votre premier serveur MCP en 2 minutes environ. ${SIGNUP_OFFER.fr}.`,
  },
};

export default async function FrSignUpPage() {
  // The Google button shows once the provider is enabled in Supabase.
  const { google } = await getOAuthProviders();
  return (
    <AuthShell locale="fr" panel="offer">
      <Suspense>
        <SignUpForm locale="fr" googleEnabled={google} />
      </Suspense>
    </AuthShell>
  );
}
