import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CORS origin for /api/*. Never fall back to "*" in production — lock to the
// configured origin (or the site URL); only allow "*" in dev.
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NODE_ENV === "production" ? "" : "*");

// PostHog ingestion host (EU cloud by default). `||`, not `??`: the Docker
// build passes an unset build arg as "". The browser never calls it directly:
// posthog-js posts to the same-origin /ingest proxy below (lib/analytics/funnel.ts).
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com").replace(
  /\/+$/,
  ""
);
// Static assets (recorder, surveys…) live on the matching *-assets host.
const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace(/:\/\/(eu|us)\.i\./, "://$1-assets.i.");
// Belt and braces: the hosts are also allowed in the CSP, should a direct call slip through.
const POSTHOG_CSP = [...new Set(["https://*.posthog.com", POSTHOG_HOST, POSTHOG_ASSETS_HOST])].join(
  " "
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  reactStrictMode: true,
  typedRoutes: true,
  // Lint is enforced in CI (`pnpm lint`) and locally during dev, but blocking
  // `next build` on pre-existing prettier/unused-vars debt slows iteration.
  eslint: { ignoreDuringBuilds: true },
  // Enterprise is no longer sold (Free + Pro only): its old pages point to
  // the remaining offer so existing links and search results keep working.
  redirects: async () => [
    { source: "/enterprise", destination: "/plans", permanent: true },
    { source: "/fr/entreprises", destination: "/fr", permanent: true },
  ],
  // PostHog reverse proxy: analytics are first-party (/ingest on our origin),
  // so the CSP needs no third-party host and blockers of *.posthog.com do not
  // silence consenting visitors. The static rule must come first.
  rewrites: async () => [
    { source: "/ingest/static/:path*", destination: `${POSTHOG_ASSETS_HOST}/static/:path*` },
    { source: "/ingest/:path*", destination: `${POSTHOG_HOST}/:path*` },
  ],
  // PostHog API paths end with a slash (/e/, /flags/?v=2…): a trailing-slash
  // redirect would turn the POSTs into GETs.
  skipTrailingSlashRedirect: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // Google Ads tag (gtag.js), loaded only after advertising consent.
            // connect-src lists Google country domains too: conversion pings
            // redirect from www.google.com to the visitor's local Google site.
            // PostHog is proxied through /ingest ('self'); its hosts are listed
            // as a fallback.
            `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com ${POSTHOG_CSP}`,
            // Google tag debug mode (Tag Assistant) styles its badge from these.
            "style-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://fonts.googleapis.com",
            "img-src 'self' data: https:",
            `connect-src 'self' https://*.supabase.co https://*.stripe.com https://*.sentry.io https://www.googletagmanager.com https://www.google.com https://google.com https://www.google.fr https://www.google.bg https://www.google.be https://www.google.ch https://www.google.lu https://www.google.ca https://www.google.co.uk https://www.google.de https://www.google.nl https://*.doubleclick.net https://www.googleadservices.com ${POSTHOG_CSP}`,
            "frame-src https://checkout.stripe.com https://js.stripe.com https://*.doubleclick.net https://www.googletagmanager.com",
            "font-src 'self' https://fonts.gstatic.com",
          ].join("; "),
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: CORS_ORIGIN },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
        {
          key: "Access-Control-Allow-Headers",
          value: "Content-Type, Authorization, X-TwinMCP-Source",
        },
        { key: "Access-Control-Max-Age", value: "86400" },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "",
  project: process.env.SENTRY_PROJECT ?? "",
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
