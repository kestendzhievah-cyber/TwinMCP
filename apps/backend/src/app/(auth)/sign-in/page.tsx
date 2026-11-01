import type { Metadata } from "next";
import { getOAuthProviders } from "@/lib/auth/oauth-providers";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "./form";

// Login page: no SEO value — keep it out of the index (also dropped from sitemap).
// The hreflang pair with /fr/connexion is reciprocal.
export const metadata: Metadata = {
  title: { absolute: "Sign in — TwinMCP" },
  description: "Sign in to your TwinMCP dashboard to manage your MCP servers.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/sign-in",
    languages: { en: "/sign-in", fr: "/fr/connexion", "x-default": "/sign-in" },
  },
};

export default async function SignInPage() {
  // The Google button shows once the provider is enabled in Supabase.
  const { google } = await getOAuthProviders();
  return (
    <AuthShell locale="en">
      <Suspense>
        <SignInForm googleEnabled={google} />
      </Suspense>
    </AuthShell>
  );
}
