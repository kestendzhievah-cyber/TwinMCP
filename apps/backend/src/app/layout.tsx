import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { CookieConsent } from "@/components/analytics/cookie-consent";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";

// `||` not `??`: an empty-string env var (Docker ARG with no value) must also
// fall back, otherwise new URL("") below crashes the build.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://twinmcp.fr";
const GSC_VERIFICATION = process.env.NEXT_PUBLIC_GSC_VERIFICATION;
const BING_VERIFICATION = process.env.NEXT_PUBLIC_BING_VERIFICATION;
const YANDEX_VERIFICATION = process.env.NEXT_PUBLIC_YANDEX_VERIFICATION;

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TwinMCP — Run your MCP servers without managing infra",
    template: "%s · TwinMCP",
  },
  description:
    "TwinMCP runs your Model Context Protocol servers in isolated runtimes — provisioned, scaled, and connected to Cursor, Claude Code, and Windsurf in 2 minutes.",
  applicationName: "TwinMCP",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "Cursor MCP",
    "Claude Code MCP",
    "Windsurf MCP",
    "AI agent context",
    "Upstash Box",
    "MCP hosting",
    "MCP marketplace",
    "developer tools",
  ],
  authors: [{ name: "TwinMCP" }],
  creator: "TwinMCP",
  publisher: "TwinMCP",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "/",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: SITE_URL,
    title: "TwinMCP — Run your MCP servers without managing infra",
    description:
      "Provision MCP servers, install MCPs from a curated marketplace, connect Cursor / Claude Code / Windsurf in 2 minutes.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@twinmcp",
    creator: "@twinmcp",
    title: "TwinMCP — MCPs as a Service",
    description:
      "Run your MCP servers without managing infra. Cursor, Claude Code, Windsurf, in 2 minutes.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    ...(GSC_VERIFICATION ? { google: GSC_VERIFICATION } : {}),
    ...(YANDEX_VERIFICATION ? { yandex: YANDEX_VERIFICATION } : {}),
    other: {
      ...(BING_VERIFICATION ? { "msvalidate.01": BING_VERIFICATION } : {}),
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <body className="h-full font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <Suspense fallback={null}>
          <PostHogProvider>
            <ThemeProvider>
              {children}
              <Toaster />
              <CookieConsent />
            </ThemeProvider>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
