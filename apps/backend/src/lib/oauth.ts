import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type Plan } from "@/db/schema/core";
import { auditLogs, servers } from "@/db/schema/platform";
import { oauthClients, oauthCodes, oauthTokens } from "@/db/schema/oauth";

// OAuth 2.1 authorization server for remote MCP connectors (contract D4):
// Claude / ChatGPT custom connectors, Cursor, VS Code, Claude Code…
//
//   discovery   /.well-known/oauth-protected-resource[/api/mcp/…] (RFC 9728)
//               /.well-known/oauth-authorization-server            (RFC 8414)
//   register    POST /oauth/register   dynamic registration, public clients (RFC 7591)
//   authorize   GET  /oauth/authorize  → sign-in → /oauth/consent → POST /oauth/authorize
//   token       POST /oauth/token      authorization_code (PKCE S256) | refresh_token
//   revoke      POST /oauth/revoke     (RFC 7009) — users revoke in Settings → Connectors
//
// Codes (60 s, single use) and tokens (access 1 h, refresh 30 d, rotated on
// every use, reuse revokes the family) live in Postgres as SHA-256 hashes.
// An access token authenticates the MCP proxy as an mcp_proxy principal bound
// to the server the user picked on the consent screen (or to all servers), so
// the management API stays closed to it (lib/auth.ts → AuthedContext.apiKey).
//
// Kill switch: OAUTH_DISABLED=1 turns every endpoint into a 404, stops the
// proxy advertising discovery and makes issued tokens inert. Default: on.

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const ACCESS_TOKEN_TTL = 3600; // seconds
export const REFRESH_TOKEN_TTL = 86400 * 30; // seconds, sliding (reset by each rotation)
export const AUTH_CODE_TTL = 60; // seconds
/** The one scope: call the tools of the MCPs the grant can reach. */
export const OAUTH_SCOPE = "mcp";

export const ACCESS_TOKEN_PREFIX = "tmcp_at_";
export const REFRESH_TOKEN_PREFIX = "tmcp_rt_";
export const AUTH_CODE_PREFIX = "tmcp_ac_";
export const CLIENT_ID_PREFIX = "tmcp_client_";

/** CSRF double-submit cookie for the consent form (path /oauth, 10 min). */
export const CONSENT_CSRF_COOKIE = "tmcp_oauth_csrf";
export const CONSENT_CSRF_MAX_AGE = 600;

/**
 * Custom URL schemes accepted as redirect URIs, beyond https and loopback
 * http. Only desktop clients that need them: Cursor finishes its OAuth flow on
 * cursor://, VS Code can use vscode:// (or a loopback port).
 */
export const CUSTOM_REDIRECT_SCHEMES = ["cursor:", "vscode:", "vscode-insiders:"] as const;

export function isOAuthEnabled(): boolean {
  return process.env.OAUTH_DISABLED !== "1";
}

/** The public origin that issues tokens (no trailing slash). */
export function oauthIssuer(): string {
  const raw =
    process.env.OAUTH_ISSUER?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://twinmcp.fr";
  return raw.replace(/\/+$/, "");
}

/** Origins a `resource` indicator (RFC 8707) may name: the MCP endpoints we serve. */
export function allowedResourceOrigins(): string[] {
  const out = new Set<string>();
  for (const raw of [
    oauthIssuer(),
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined,
  ]) {
    if (!raw) continue;
    try {
      out.add(new URL(raw).origin);
    } catch {
      // ignore a malformed env value
    }
  }
  return [...out];
}

/** Public, cookie-less endpoints (metadata, register, token, revoke) answer any origin. */
export function oauthCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
    "Access-Control-Max-Age": "86400",
  };
}

/** Token / registration responses must never be cached (RFC 6749 §5.1). */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in src/__tests__/oauth.test.ts)
// ---------------------------------------------------------------------------

/** SHA-256 hex of a code / token. Inputs are 256-bit random, so no salt or KDF is needed. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** `<prefix><43 base64url chars>` — 256 bits of entropy. */
export function generateToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

/** Constant-time string equality (hashes both sides so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

const PKCE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
const PKCE_CHALLENGE_S256 = /^[A-Za-z0-9_-]{43}$/;

/** RFC 7636 §4.1: 43–128 unreserved characters. */
export function isValidCodeVerifier(v: string): boolean {
  return PKCE_VERIFIER.test(v);
}

/** An S256 challenge is the 43-char base64url (no padding) of a SHA-256. */
export function isValidCodeChallenge(c: string): boolean {
  return PKCE_CHALLENGE_S256.test(c);
}

export function pkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** PKCE S256 check — the only method accepted ("plain" is refused at /authorize). */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!isValidCodeVerifier(verifier) || !isValidCodeChallenge(challenge)) return false;
  return safeEqual(pkceChallengeS256(verifier), challenge);
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isLoopbackHttp(u: URL): boolean {
  return u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname);
}

export type RedirectCheck = { ok: true } | { ok: false; reason: string };

/**
 * May a client register this redirect URI? https anywhere, http only on a
 * loopback host (native apps, RFC 8252 §7.3), or one of the allow-listed
 * desktop schemes. Never a fragment, credentials, or a script-ish scheme.
 */
export function validateRedirectUri(raw: unknown): RedirectCheck {
  if (typeof raw !== "string" || raw.length === 0) return { ok: false, reason: "empty" };
  if (raw.length > 2048) return { ok: false, reason: "too long" };
  if (/[\u0000- \u007f\\]/.test(raw)) return { ok: false, reason: "invalid characters" };
  const u = parseUrl(raw);
  if (!u) return { ok: false, reason: "not an absolute URL" };
  if (u.hash || raw.includes("#")) return { ok: false, reason: "fragment not allowed" };
  if (u.username || u.password) return { ok: false, reason: "credentials not allowed" };
  if (u.protocol === "https:") {
    return u.hostname ? { ok: true } : { ok: false, reason: "missing host" };
  }
  if (u.protocol === "http:") {
    return isLoopbackHttp(u) ? { ok: true } : { ok: false, reason: "http only on loopback" };
  }
  if ((CUSTOM_REDIRECT_SCHEMES as readonly string[]).includes(u.protocol)) return { ok: true };
  return { ok: false, reason: `scheme ${u.protocol} not allowed` };
}

/**
 * Exact string match against the registered list, with the one exception
 * RFC 8252 §7.3 requires: a loopback http URI may use any port (native apps
 * bind an ephemeral one), host, path and query still exact.
 */
export function redirectUriMatches(registered: readonly string[], requested: string): boolean {
  if (!requested) return false;
  if (registered.includes(requested)) return true;
  const req = parseUrl(requested);
  if (!req || !isLoopbackHttp(req) || req.hash || req.username || req.password) return false;
  return registered.some((r) => {
    const reg = parseUrl(r);
    return (
      !!reg &&
      isLoopbackHttp(reg) &&
      reg.hostname === req.hostname &&
      reg.pathname === req.pathname &&
      reg.search === req.search
    );
  });
}

export function isExpired(expiresAt: Date, now: number = Date.now()): boolean {
  return expiresAt.getTime() <= now;
}

/**
 * One scope exists. Whatever a client asks for (none, "mcp", the retired
 * "mcp.read mcp.write", "openid"…), the grant is "mcp" — the server binding
 * chosen on the consent screen is what narrows access.
 */
export function normalizeScope(_requested: string | null | undefined): string {
  return OAUTH_SCOPE;
}

export type ResourceCheck =
  | { ok: true; resource: string | null; serverSlug: string | null }
  | { ok: false };

const MCP_PATH = /^\/(?:api\/)?mcp(?:\/([^/?#]+))?(?:\/[^?#]*)?$/;

/**
 * RFC 8707 resource indicator: absent, or one of our MCP endpoints
 * (https://twinmcp.fr/api/mcp[/<server>[/<mcp>]]). The server slug, when
 * present, preselects that server on the consent screen.
 */
export function parseResource(
  raw: string | null | undefined,
  allowedOrigins: readonly string[]
): ResourceCheck {
  if (!raw) return { ok: true, resource: null, serverSlug: null };
  const u = parseUrl(raw);
  if (!u || u.hash || u.username || u.password) return { ok: false };
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false };
  if (!allowedOrigins.includes(u.origin)) return { ok: false };
  const path = u.pathname.replace(/\/+$/, "");
  if (path === "") return { ok: true, resource: raw, serverSlug: null };
  const m = MCP_PATH.exec(path);
  if (!m) return { ok: false };
  let slug: string | null = null;
  if (m[1]) {
    try {
      slug = decodeURIComponent(m[1]);
    } catch {
      return { ok: false };
    }
  }
  return { ok: true, resource: raw, serverSlug: slug };
}

/**
 * The server slug an RFC 8707 resource names (`…/api/mcp/<slug>[/<mcp>]`), or
 * null for a resource that names no server (absent, the origin, unparseable).
 * Path only: the origin was checked when the grant was made.
 */
export function resourceServerSlug(resource: string | null | undefined): string | null {
  if (!resource) return null;
  const u = parseUrl(resource);
  if (!u) return null;
  const m = MCP_PATH.exec(u.pathname.replace(/\/+$/, ""));
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

export function buildAuthorizationServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [OAUTH_SCOPE],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${issuer}/docs`,
  };
}

/**
 * RFC 9728 metadata for an MCP endpoint. `resourcePath` is "" for the
 * collection root or e.g. "/api/mcp/my-server" for one endpoint.
 */
export function buildProtectedResourceMetadata(issuer: string, resourcePath: string) {
  return {
    resource: `${issuer}${resourcePath || "/api/mcp"}`,
    authorization_servers: [issuer],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "TwinMCP",
    resource_documentation: `${issuer}/docs`,
  };
}

/** Is this a path the per-resource metadata route may describe? */
export function isMcpResourcePath(path: string): boolean {
  return /^\/api\/mcp(?:\/[A-Za-z0-9._~-]+){0,2}$/.test(path);
}

/** The metadata URL a 401 points to for `pathname` (falls back to the root document). */
export function protectedResourceMetadataUrl(issuer: string, pathname: string): string {
  const clean = pathname.replace(/\/+$/, "");
  const base = `${issuer}/.well-known/oauth-protected-resource`;
  return isMcpResourcePath(clean) ? `${base}${clean}` : base;
}

/** The WWW-Authenticate value for a 401 on the MCP proxy (pure form). */
export function wwwAuthenticateValue(opts: {
  issuer: string;
  pathname: string;
  /** The request carried a bearer token (it was invalid / expired). */
  hadToken: boolean;
  enabled: boolean;
}): string {
  const parts = ['Bearer realm="twinmcp"'];
  if (opts.enabled) {
    parts.push(
      `resource_metadata="${protectedResourceMetadataUrl(opts.issuer, opts.pathname)}"`,
      `scope="${OAUTH_SCOPE}"`
    );
  }
  if (opts.hadToken || !opts.enabled) parts.push('error="invalid_token"');
  return parts.join(", ");
}

/**
 * `WWW-Authenticate` for the MCP proxy's 401 (MCP authorization spec): points
 * the client at the protected-resource metadata so it can start OAuth.
 * Usage in a proxy route: `headers: { "WWW-Authenticate": wwwAuthenticateHeader(req) }`.
 */
export function wwwAuthenticateHeader(req: Request): string {
  let pathname = "/api/mcp";
  try {
    pathname = new URL(req.url).pathname;
  } catch {
    // keep the root
  }
  return wwwAuthenticateValue({
    issuer: oauthIssuer(),
    pathname,
    hadToken: (req.headers.get("authorization") ?? "").trim().length > "Bearer".length,
    enabled: isOAuthEnabled(),
  });
}

/** redirect_uri?error=…&state=…&iss=… (RFC 6749 §4.1.2.1, RFC 9207). */
export function buildRedirect(
  redirectUri: string,
  params: Record<string, string | null | undefined>
): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") u.searchParams.set(k, v);
  }
  return u.toString();
}

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  responseType: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
  resource: string;
}

/** Read /authorize parameters from a query string or the consent form. */
export function readAuthorizeParams(get: (name: string) => string | null): AuthorizeParams {
  const s = (name: string, max = 2048) => (get(name) ?? "").trim().slice(0, max);
  return {
    clientId: s("client_id", 200),
    redirectUri: s("redirect_uri"),
    responseType: s("response_type", 50),
    codeChallenge: s("code_challenge", 200),
    codeChallengeMethod: s("code_challenge_method", 20),
    state: s("state", 1024),
    scope: s("scope", 500),
    resource: s("resource"),
  };
}

/** The same parameters as a query string (sign-in returnTo, consent URL). */
export function authorizeQuery(p: AuthorizeParams): string {
  const q = new URLSearchParams();
  const pairs: Array<[string, string]> = [
    ["client_id", p.clientId],
    ["redirect_uri", p.redirectUri],
    ["response_type", p.responseType],
    ["code_challenge", p.codeChallenge],
    ["code_challenge_method", p.codeChallengeMethod],
    ["state", p.state],
    ["scope", p.scope],
    ["resource", p.resource],
  ];
  for (const [k, v] of pairs) if (v) q.set(k, v);
  return q.toString();
}

/**
 * Checks after the client and redirect URI are known good (so errors can go
 * back to the client): response_type=code, PKCE S256 mandatory, a resource
 * that names one of our MCP endpoints.
 */
export function checkAuthorizeParams(
  p: AuthorizeParams,
  allowedOrigins: readonly string[]
):
  | { ok: true; serverSlug: string | null; resource: string | null }
  | { ok: false; error: string; description: string } {
  if (p.responseType !== "code") {
    return {
      ok: false,
      error: "unsupported_response_type",
      description: "response_type must be code",
    };
  }
  if (!p.codeChallenge) {
    return { ok: false, error: "invalid_request", description: "PKCE code_challenge is required" };
  }
  if (p.codeChallengeMethod !== "S256") {
    return {
      ok: false,
      error: "invalid_request",
      description: "code_challenge_method must be S256",
    };
  }
  if (!isValidCodeChallenge(p.codeChallenge)) {
    return { ok: false, error: "invalid_request", description: "malformed code_challenge" };
  }
  const r = parseResource(p.resource || null, allowedOrigins);
  if (!r.ok) {
    return { ok: false, error: "invalid_target", description: "resource is not a TwinMCP MCP URL" };
  }
  return { ok: true, serverSlug: r.serverSlug, resource: r.resource };
}

export type RegistrationResult =
  | { ok: true; clientName: string; redirectUris: string[]; clientUri: string | null }
  | { ok: false; error: "invalid_redirect_uri" | "invalid_client_metadata"; description: string };

/** RFC 7591 request validation. Public clients only; at most 10 redirect URIs. */
export function validateRegistration(body: Record<string, unknown>): RegistrationResult {
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0) {
    return { ok: false, error: "invalid_redirect_uri", description: "redirect_uris is required" };
  }
  if (uris.length > 10) {
    return { ok: false, error: "invalid_redirect_uri", description: "at most 10 redirect_uris" };
  }
  for (const u of uris) {
    const c = validateRedirectUri(u);
    if (!c.ok) {
      return {
        ok: false,
        error: "invalid_redirect_uri",
        description: `redirect_uri rejected: ${c.reason}`,
      };
    }
  }
  const grantTypes = body.grant_types;
  if (
    grantTypes !== undefined &&
    (!Array.isArray(grantTypes) ||
      grantTypes.some((g) => g !== "authorization_code" && g !== "refresh_token"))
  ) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      description: "grant_types: only authorization_code and refresh_token",
    };
  }
  const responseTypes = body.response_types;
  if (
    responseTypes !== undefined &&
    (!Array.isArray(responseTypes) || responseTypes.some((r) => r !== "code"))
  ) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      description: "response_types: only code",
    };
  }
  const rawName = typeof body.client_name === "string" ? body.client_name : "";
  const clientName =
    rawName
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 100) || "MCP client";
  let clientUri: string | null = null;
  if (typeof body.client_uri === "string") {
    const u = parseUrl(body.client_uri);
    if (
      u &&
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      body.client_uri.length <= 512
    ) {
      clientUri = u.toString();
    }
  }
  return { ok: true, clientName, redirectUris: [...new Set(uris as string[])], clientUri };
}

/** A redirect URI shown on the consent screen: the host (or the custom scheme) only. */
export function redirectTargetLabel(redirectUri: string): string {
  const u = parseUrl(redirectUri);
  if (!u) return redirectUri;
  if (u.protocol === "https:" || u.protocol === "http:") return u.host;
  return `${u.protocol}//${u.host}`;
}

/**
 * In-process fixed-window limiter. The token / registration endpoints must
 * not depend on Redis (prod Redis can be down; the limiter must still bite).
 * Per process — prod is one container.
 */
export function createWindowLimiter(limit: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key: string, now: number = Date.now()): { ok: boolean; retryAfterSec: number } {
      let e = hits.get(key);
      if (!e || e.resetAt <= now) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
          if (hits.size >= maxKeys) hits.clear();
        }
        e = { count: 0, resetAt: now + windowMs };
        hits.set(key, e);
      }
      e.count += 1;
      const ok = e.count <= limit;
      return { ok, retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((e.resetAt - now) / 1000)) };
    },
  };
}

// Token endpoint: per client and per IP (connector backends such as claude.ai
// share egress IPs across all their users, hence the generous IP ceiling).
export const tokenClientLimiter = createWindowLimiter(60, 60_000);
export const tokenIpLimiter = createWindowLimiter(600, 60_000);
export const registerIpLimiter = createWindowLimiter(30, 60_000);

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

type OAuthAuditAction = "oauth.authorize" | "oauth.revoke" | "oauth.token_reuse";

/** Fire-and-forget row in audit_logs (same shape as lib/audit). */
export function oauthAudit(
  userId: string,
  action: OAuthAuditAction,
  /** The token family, or the oauth_clients.id for oauth.authorize (no family yet). */
  targetId: string,
  metadata: Record<string, unknown> = {},
  ip: string | null = null
): void {
  try {
    void getDb()
      .insert(auditLogs)
      .values({
        id: randomUUID(),
        userId,
        action,
        targetType: "oauth_connection",
        targetId,
        metadata,
        ip,
      })
      .catch((err) => console.error("[oauth] audit insert failed:", action, err));
  } catch (err) {
    console.error("[oauth] audit insert failed:", action, err);
  }
}

export async function registerClient(input: {
  clientName: string;
  redirectUris: string[];
  clientUri: string | null;
}) {
  const clientId = `${CLIENT_ID_PREFIX}${randomBytes(16).toString("hex")}`;
  const [row] = await getDb()
    .insert(oauthClients)
    .values({
      clientId,
      clientName: input.clientName,
      redirectUris: input.redirectUris,
      clientUri: input.clientUri,
    })
    .returning();
  return row;
}

export async function getClient(clientId: string) {
  if (!clientId.startsWith(CLIENT_ID_PREFIX) || clientId.length > 100) return null;
  const [row] = await getDb()
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  return row ?? null;
}

export type ResolvedAuthorize =
  /** Unknown client or unregistered redirect URI: never redirect, show an error. */
  | { kind: "fatal"; error: string; description: string }
  /** The client is known: send the error back to its redirect URI. */
  | { kind: "redirect_error"; redirectUri: string; error: string; description: string }
  | {
      kind: "ok";
      params: AuthorizeParams;
      client: NonNullable<Awaited<ReturnType<typeof getClient>>>;
      redirectUri: string;
      resource: string | null;
      serverSlug: string | null;
    };

/** Full /authorize validation, shared by the GET route, the consent page and the POST. */
export async function resolveAuthorize(p: AuthorizeParams): Promise<ResolvedAuthorize> {
  if (!p.clientId) {
    return { kind: "fatal", error: "invalid_request", description: "client_id is required" };
  }
  const client = await getClient(p.clientId);
  if (!client) {
    return { kind: "fatal", error: "invalid_client", description: "Unknown client_id" };
  }
  // redirect_uri may be omitted only when exactly one is registered.
  let redirectUri = p.redirectUri;
  if (!redirectUri && client.redirectUris.length === 1) redirectUri = client.redirectUris[0];
  if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
    return {
      kind: "fatal",
      error: "invalid_request",
      description: "redirect_uri is not registered for this client",
    };
  }
  const check = checkAuthorizeParams(p, allowedResourceOrigins());
  if (!check.ok) {
    return {
      kind: "redirect_error",
      redirectUri,
      error: check.error,
      description: check.description,
    };
  }
  return {
    kind: "ok",
    params: { ...p, redirectUri },
    client,
    redirectUri,
    resource: check.resource,
    serverSlug: check.serverSlug,
  };
}

/** Issue a 60-second, single-use authorization code. Returns the raw code. */
export async function createAuthorizationCode(input: {
  clientRowId: string;
  userId: string;
  serverId: string | null;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string | null;
}): Promise<string> {
  const code = generateToken(AUTH_CODE_PREFIX);
  await getDb()
    .insert(oauthCodes)
    .values({
      codeHash: hashToken(code),
      clientId: input.clientRowId,
      userId: input.userId,
      serverId: input.serverId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      resource: input.resource,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL * 1000),
    });
  return code;
}

export interface IssuedTokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export type TokenResult =
  | { ok: true; tokens: IssuedTokens }
  | {
      ok: false;
      error: "invalid_grant" | "invalid_target" | "invalid_client";
      description: string;
    };

async function insertTokenPair(row: {
  familyId: string;
  clientRowId: string;
  userId: string;
  serverId: string | null;
  scope: string;
  resource: string | null;
  authorizedAt?: Date;
}): Promise<IssuedTokens> {
  const access = generateToken(ACCESS_TOKEN_PREFIX);
  const refresh = generateToken(REFRESH_TOKEN_PREFIX);
  const now = Date.now();
  await getDb()
    .insert(oauthTokens)
    .values({
      familyId: row.familyId,
      clientId: row.clientRowId,
      userId: row.userId,
      serverId: row.serverId,
      accessTokenHash: hashToken(access),
      refreshTokenHash: hashToken(refresh),
      scope: row.scope,
      resource: row.resource,
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL * 1000),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL * 1000),
      authorizedAt: row.authorizedAt ?? new Date(now),
      lastUsedAt: new Date(now),
    });
  void getDb()
    .update(oauthClients)
    .set({ lastUsedAt: new Date(now) })
    .where(eq(oauthClients.id, row.clientRowId))
    .catch(() => {});
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refresh,
    scope: row.scope,
  };
}

/** authorization_code grant: single use, PKCE S256, same client + redirect URI. */
export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  resource: string | null;
}): Promise<TokenResult> {
  const client = await getClient(input.clientId);
  if (!client) return { ok: false, error: "invalid_client", description: "Unknown client_id" };

  const db = getDb();
  const codeHash = hashToken(input.code);
  // Claim the code atomically: a second exchange finds used_at set. Bound to
  // the client it was issued to, so a leaked code presented with another
  // client_id neither burns it nor triggers the replay revocation.
  const [row] = await db
    .update(oauthCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(oauthCodes.codeHash, codeHash),
        eq(oauthCodes.clientId, client.id),
        isNull(oauthCodes.usedAt)
      )
    )
    .returning();
  if (!row) {
    // Replay of a spent code (RFC 6749 §4.1.2) by its own client: revoke
    // what it produced.
    const [spent] = await db
      .select({ familyId: oauthCodes.familyId, userId: oauthCodes.userId })
      .from(oauthCodes)
      .where(and(eq(oauthCodes.codeHash, codeHash), eq(oauthCodes.clientId, client.id)))
      .limit(1);
    if (spent?.familyId) {
      await revokeFamily(spent.familyId, spent.userId);
      oauthAudit(spent.userId, "oauth.token_reuse", spent.familyId, {
        grant: "authorization_code",
      });
    }
    return { ok: false, error: "invalid_grant", description: "invalid or already used code" };
  }
  if (isExpired(row.expiresAt)) {
    return { ok: false, error: "invalid_grant", description: "code expired" };
  }
  if (row.clientId !== client.id) {
    return { ok: false, error: "invalid_grant", description: "code was issued to another client" };
  }
  if (!safeEqual(row.redirectUri, input.redirectUri)) {
    return { ok: false, error: "invalid_grant", description: "redirect_uri mismatch" };
  }
  if (!verifyPkceS256(input.codeVerifier, row.codeChallenge)) {
    return { ok: false, error: "invalid_grant", description: "PKCE verification failed" };
  }
  if (input.resource && row.resource && input.resource !== row.resource) {
    return {
      ok: false,
      error: "invalid_target",
      description: "resource differs from the authorization request",
    };
  }

  const familyId = randomUUID();
  const tokens = await insertTokenPair({
    familyId,
    clientRowId: client.id,
    userId: row.userId,
    serverId: row.serverId,
    scope: row.scope,
    resource: row.resource,
  });
  void db
    .update(oauthCodes)
    .set({ familyId })
    .where(eq(oauthCodes.id, row.id))
    .catch((err) => console.error("[oauth] code family link failed:", err));
  return { ok: true, tokens };
}

/**
 * A rotated refresh token presented again by its own client within this
 * window is a retry after a lost response, not theft: it gets a fresh pair
 * instead of revoking the grant (OAuth 2.1 security BCP, reuse grace).
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/** Is a second use of a refresh token rotated at `rotatedAt` inside the grace window? */
export function withinRefreshGrace(rotatedAt: Date | null, now: number = Date.now()): boolean {
  return (
    !!rotatedAt &&
    now - rotatedAt.getTime() >= 0 &&
    now - rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS
  );
}

/**
 * refresh_token grant with rotation. The presented token's row is marked
 * rotated and a fresh pair joins the family. A rotated / foreign token
 * presented again is reuse: the whole family is revoked — except the same
 * client retrying within REFRESH_REUSE_GRACE_MS, which gets a fresh pair.
 */
export async function rotateRefreshToken(input: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenResult> {
  const client = await getClient(input.clientId);
  if (!client) return { ok: false, error: "invalid_client", description: "Unknown client_id" };
  if (!input.refreshToken.startsWith(REFRESH_TOKEN_PREFIX)) {
    return { ok: false, error: "invalid_grant", description: "invalid refresh token" };
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.refreshTokenHash, hashToken(input.refreshToken)))
    .limit(1);
  if (!row || row.revokedAt) {
    return { ok: false, error: "invalid_grant", description: "invalid refresh token" };
  }
  const reuse = async () => {
    await revokeFamily(row.familyId, row.userId);
    oauthAudit(row.userId, "oauth.token_reuse", row.familyId, { grant: "refresh_token" });
    return {
      ok: false as const,
      error: "invalid_grant" as const,
      description: "refresh token reuse detected; the authorization was revoked",
    };
  };
  const freshPair = async () => {
    const tokens = await insertTokenPair({
      familyId: row.familyId,
      clientRowId: client.id,
      userId: row.userId,
      serverId: row.serverId,
      scope: row.scope,
      resource: row.resource,
      authorizedAt: row.authorizedAt,
    });
    return { ok: true as const, tokens };
  };
  if (row.clientId !== client.id) return reuse();
  if (isExpired(row.refreshExpiresAt)) {
    return { ok: false, error: "invalid_grant", description: "refresh token expired" };
  }
  if (row.rotatedAt) return withinRefreshGrace(row.rotatedAt) ? freshPair() : reuse();

  const [claimed] = await db
    .update(oauthTokens)
    .set({ rotatedAt: new Date() })
    .where(
      and(eq(oauthTokens.id, row.id), isNull(oauthTokens.rotatedAt), isNull(oauthTokens.revokedAt))
    )
    .returning({ id: oauthTokens.id });
  if (!claimed) {
    // Lost a race with another use of the same token: a concurrent retry
    // (fresh pair) unless the grant was revoked meanwhile.
    const [now] = await db
      .select({ revokedAt: oauthTokens.revokedAt, rotatedAt: oauthTokens.rotatedAt })
      .from(oauthTokens)
      .where(eq(oauthTokens.id, row.id))
      .limit(1);
    if (!now || now.revokedAt) {
      return { ok: false, error: "invalid_grant", description: "invalid refresh token" };
    }
    return withinRefreshGrace(now.rotatedAt) ? freshPair() : reuse();
  }

  const tokens = await insertTokenPair({
    familyId: row.familyId,
    clientRowId: client.id,
    userId: row.userId,
    serverId: row.serverId,
    scope: row.scope,
    resource: row.resource,
    authorizedAt: row.authorizedAt,
  });
  return { ok: true, tokens };
}

/** Revoke every token of a family (a connector authorization). Scoped to the owner. */
export async function revokeFamily(familyId: string, userId: string): Promise<boolean> {
  const rows = await getDb()
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(oauthTokens.familyId, familyId),
        eq(oauthTokens.userId, userId),
        isNull(oauthTokens.revokedAt)
      )
    )
    .returning({ id: oauthTokens.id });
  clearOAuthTokenCache();
  return rows.length > 0;
}

/**
 * RFC 7009 revocation by token (access or refresh): revokes its family. Always
 * "succeeds" from the caller's view — an unknown token is not an error.
 */
export async function revokeByToken(token: string, clientId: string): Promise<void> {
  const client = await getClient(clientId);
  if (!client) return;
  const h = hashToken(token);
  const [row] = await getDb()
    .select({
      familyId: oauthTokens.familyId,
      userId: oauthTokens.userId,
      clientId: oauthTokens.clientId,
    })
    .from(oauthTokens)
    .where(or(eq(oauthTokens.accessTokenHash, h), eq(oauthTokens.refreshTokenHash, h)))
    .limit(1);
  if (!row || row.clientId !== client.id) return;
  if (await revokeFamily(row.familyId, row.userId)) {
    oauthAudit(row.userId, "oauth.revoke", row.familyId, {
      by: "client",
      clientName: client.clientName,
    });
  }
}

/** What an OAuth access token authenticates as (lib/auth.ts builds AuthedContext from it). */
export interface OAuthPrincipal {
  tokenId: string;
  familyId: string;
  userId: string;
  /** oauth_clients.id */
  clientRowId: string;
  /** The one server the grant reaches; null = all of the user's servers. */
  serverId: string | null;
  /**
   * RFC 8707 audience: the server slug the token was requested for (the
   * connector URL), or null. The proxy refuses other servers' paths.
   */
  resourceServerSlug: string | null;
  accessExpiresAt: Date;
  plan: Plan;
  hasStripeCustomer: boolean;
}

// Per-process cache, like the API-key auth cache: every MCP request of a tool
// loop presents the same token. Only live tokens are cached; revocation clears
// it, expiry is checked on every hit.
const TOKEN_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 30_000);
const LAST_USED_THROTTLE_MS = 60_000;
const tokenCache = new Map<
  string,
  { p: OAuthPrincipal; cachedAt: number; lastUsedWrittenAt: number }
>();

export function clearOAuthTokenCache(): void {
  tokenCache.clear();
}

/**
 * Resolve a raw `tmcp_at_…` access token. Null when unknown, revoked or
 * expired. An access token stays valid until its own expiry after its refresh
 * token rotated (in-flight calls keep working); revoking the family kills it.
 */
export async function verifyAccessToken(raw: string): Promise<OAuthPrincipal | null> {
  if (!raw.startsWith(ACCESS_TOKEN_PREFIX) || raw.length > 200) return null;
  const h = hashToken(raw);
  const now = Date.now();
  let entry = tokenCache.get(h);
  if (!entry || now - entry.cachedAt > TOKEN_CACHE_TTL_MS) {
    const [row] = await getDb()
      .select({
        tokenId: oauthTokens.id,
        familyId: oauthTokens.familyId,
        userId: oauthTokens.userId,
        clientRowId: oauthTokens.clientId,
        serverId: oauthTokens.serverId,
        resource: oauthTokens.resource,
        accessExpiresAt: oauthTokens.accessExpiresAt,
        revokedAt: oauthTokens.revokedAt,
        plan: users.plan,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(oauthTokens)
      .innerJoin(users, eq(users.id, oauthTokens.userId))
      .where(eq(oauthTokens.accessTokenHash, h))
      .limit(1);
    if (!row || row.revokedAt) {
      tokenCache.delete(h);
      return null;
    }
    if (tokenCache.size > 5000) tokenCache.clear();
    entry = {
      p: {
        tokenId: row.tokenId,
        familyId: row.familyId,
        userId: row.userId,
        clientRowId: row.clientRowId,
        serverId: row.serverId ?? null,
        resourceServerSlug: resourceServerSlug(row.resource),
        accessExpiresAt: row.accessExpiresAt,
        plan: row.plan,
        hasStripeCustomer: Boolean(row.stripeCustomerId),
      },
      cachedAt: now,
      lastUsedWrittenAt: entry?.lastUsedWrittenAt ?? 0,
    };
    tokenCache.set(h, entry);
  }
  if (isExpired(entry.p.accessExpiresAt, now)) {
    tokenCache.delete(h);
    return null;
  }
  if (now - entry.lastUsedWrittenAt > LAST_USED_THROTTLE_MS) {
    entry.lastUsedWrittenAt = now;
    void getDb()
      .update(oauthTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(oauthTokens.id, entry.p.tokenId))
      .catch(() => {});
  }
  return entry.p;
}

export interface OAuthConnection {
  /** The family id — what the dashboard revokes. */
  id: string;
  clientName: string;
  clientUri: string | null;
  serverId: string | null;
  serverName: string | null;
  serverSlug: string | null;
  authorizedAt: string;
  lastUsedAt: string | null;
  /** When access ends if the connector stops refreshing. */
  expiresAt: string;
}

/** The live connector authorizations of a user (one per token family). */
export async function listConnections(userId: string): Promise<OAuthConnection[]> {
  const rows = await getDb()
    .select({
      id: oauthTokens.familyId,
      clientName: oauthClients.clientName,
      clientUri: oauthClients.clientUri,
      serverId: oauthTokens.serverId,
      serverName: servers.name,
      serverSlug: servers.slug,
      authorizedAt: oauthTokens.authorizedAt,
      lastUsedAt: oauthTokens.lastUsedAt,
      refreshExpiresAt: oauthTokens.refreshExpiresAt,
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .leftJoin(servers, eq(servers.id, oauthTokens.serverId))
    .where(
      and(
        eq(oauthTokens.userId, userId),
        isNull(oauthTokens.revokedAt),
        isNull(oauthTokens.rotatedAt),
        gt(oauthTokens.refreshExpiresAt, new Date())
      )
    )
    .orderBy(desc(oauthTokens.authorizedAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    clientUri: r.clientUri,
    serverId: r.serverId,
    serverName: r.serverName ?? null,
    serverSlug: r.serverSlug ?? null,
    authorizedAt: r.authorizedAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    expiresAt: r.refreshExpiresAt.toISOString(),
  }));
}

/**
 * Housekeeping, run opportunistically (fire-and-forget) from the public
 * endpoints: spent codes, long-dead tokens, and registrations that never got
 * a token (dynamic registration is unauthenticated). A client that was used
 * once is kept: connectors cache their client_id and reconnect with it.
 */
export function maybePruneOAuth(probability = 0.02): void {
  if (Math.random() >= probability) return;
  const db = getDb();
  const day = new Date(Date.now() - 86_400_000);
  const week = new Date(Date.now() - 7 * 86_400_000);
  void (async () => {
    await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, day));
    await db
      .delete(oauthTokens)
      .where(or(lt(oauthTokens.refreshExpiresAt, day), lt(oauthTokens.revokedAt, week)));
    await db
      .delete(oauthClients)
      .where(
        and(
          lt(oauthClients.createdAt, day),
          isNull(oauthClients.lastUsedAt),
          sql`NOT EXISTS (SELECT 1 FROM ${oauthCodes} WHERE ${oauthCodes.clientId} = ${oauthClients.id})`
        )
      );
  })().catch((err) => console.error("[oauth] prune failed:", err));
}
