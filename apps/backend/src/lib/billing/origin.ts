import type { NextRequest } from "next/server";

// The public origin used to build Stripe redirect URLs (success/cancel/return).
// We only trust the request's Origin header when it's a KNOWN origin (the
// configured site, or localhost in dev); anything else falls back to the site
// URL. This keeps local development working while stopping a spoofed Origin
// header from steering the post-checkout redirect.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr").replace(/\/$/, "");

const ALLOWED = new Set(
  [SITE_URL, "https://twinmcp.fr", "http://localhost:3000"].map((o) => o.replace(/\/$/, ""))
);

export function returnOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin")?.replace(/\/$/, "");
  return origin && ALLOWED.has(origin) ? origin : SITE_URL;
}
