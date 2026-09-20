// Serving the API on a dedicated origin (e.g. https://api.twinmcp.fr), separate
// from the front-end, for isolation. This is OFF until NEXT_PUBLIC_API_URL is
// set: until then isApiHost() always returns false and the middleware behaves
// exactly as before. See docs/API-SUBDOMAIN.md for activation.
//
// Server-side only (imported by middleware.ts). The public URL shown to users is
// derived from the same NEXT_PUBLIC_API_URL in lib/mcp/client-config.ts.

function normalizeHost(host: string): string {
  // Strip any comma-joined proxy chain, trailing dot, and port.
  return host.toLowerCase().split(",")[0].trim().replace(/\.$/, "").split(":")[0];
}

const API_HOST: string | undefined = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return undefined;
  try {
    return normalizeHost(new URL(raw).host);
  } catch {
    return undefined;
  }
})();

/** True when the incoming request targets the dedicated API origin. */
export function isApiHost(host: string | null | undefined): boolean {
  if (!API_HOST || !host) return false;
  return normalizeHost(host) === API_HOST;
}

/**
 * CORS for the dedicated API origin. Auth is via Bearer `ctx7sk_` tokens (never
 * cookies), so we can reflect any browser origin with `*` and no credentials —
 * the token, not the origin, is the security boundary. CORS only gates browser
 * JS anyway; non-browser clients (CLI, IDEs, servers) ignore it entirely.
 */
export function apiCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
