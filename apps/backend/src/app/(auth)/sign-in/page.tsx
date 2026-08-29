import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./form";

// Login page: no SEO value — keep it out of the index (also dropped from sitemap).
export const metadata: Metadata = {
  title: "Sign in — TwinMCP",
  description: "Sign in to your TwinMCP dashboard to manage your MCP servers.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/sign-in" },
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
