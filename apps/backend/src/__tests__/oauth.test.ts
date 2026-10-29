import { describe, it, expect, afterEach } from "vitest";
import { createHash } from "crypto";
import {
  ACCESS_TOKEN_PREFIX,
  AUTH_CODE_TTL,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  authorizeQuery,
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  buildRedirect,
  checkAuthorizeParams,
  createWindowLimiter,
  generateToken,
  hashToken,
  isExpired,
  isMcpResourcePath,
  isOAuthEnabled,
  isValidCodeChallenge,
  isValidCodeVerifier,
  normalizeScope,
  parseResource,
  pkceChallengeS256,
  protectedResourceMetadataUrl,
  readAuthorizeParams,
  redirectTargetLabel,
  redirectUriMatches,
  safeEqual,
  validateRedirectUri,
  validateRegistration,
  verifyPkceS256,
  wwwAuthenticateHeader,
  wwwAuthenticateValue,
  type AuthorizeParams,
} from "@/lib/oauth";

const ORIGINS = ["https://twinmcp.fr"];
// RFC 7636 Appendix B test vector.
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("lifetimes (contract D4)", () => {
  it("codes ≤ 60 s, access 1 h, refresh 30 d", () => {
    expect(AUTH_CODE_TTL).toBeLessThanOrEqual(60);
    expect(ACCESS_TOKEN_TTL).toBe(3600);
    expect(REFRESH_TOKEN_TTL).toBe(30 * 86400);
  });
});

describe("kill switch", () => {
  const prev = process.env.OAUTH_DISABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.OAUTH_DISABLED;
    else process.env.OAUTH_DISABLED = prev;
  });
  it("is on by default and off with OAUTH_DISABLED=1", () => {
    delete process.env.OAUTH_DISABLED;
    expect(isOAuthEnabled()).toBe(true);
    process.env.OAUTH_DISABLED = "1";
    expect(isOAuthEnabled()).toBe(false);
    process.env.OAUTH_DISABLED = "0";
    expect(isOAuthEnabled()).toBe(true);
  });
});

describe("PKCE S256", () => {
  it("matches the RFC 7636 test vector", () => {
    expect(pkceChallengeS256(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
    expect(verifyPkceS256(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true);
  });

  it("rejects a wrong verifier", () => {
    const other = "a".repeat(43);
    expect(verifyPkceS256(other, RFC_CHALLENGE)).toBe(false);
  });

  it("refuses the plain method trick (verifier === challenge)", () => {
    expect(verifyPkceS256(RFC_CHALLENGE, RFC_CHALLENGE)).toBe(false);
  });

  it("validates verifier and challenge shapes", () => {
    expect(isValidCodeVerifier("short")).toBe(false);
    expect(isValidCodeVerifier("a".repeat(43))).toBe(true);
    expect(isValidCodeVerifier("a".repeat(129))).toBe(false);
    expect(isValidCodeVerifier(`${"a".repeat(42)} `)).toBe(false);
    expect(isValidCodeChallenge(RFC_CHALLENGE)).toBe(true);
    expect(isValidCodeChallenge(`${RFC_CHALLENGE}=`)).toBe(false);
    expect(isValidCodeChallenge("plain-text-challenge")).toBe(false);
    expect(verifyPkceS256("bad", RFC_CHALLENGE)).toBe(false);
  });
});

describe("token hashing", () => {
  it("is SHA-256 hex, deterministic, never the raw value", () => {
    const t = generateToken(ACCESS_TOKEN_PREFIX);
    expect(hashToken(t)).toBe(createHash("sha256").update(t).digest("hex"));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });

  it("generates prefixed 256-bit tokens that never repeat", () => {
    const a = generateToken(ACCESS_TOKEN_PREFIX);
    const b = generateToken(ACCESS_TOKEN_PREFIX);
    expect(a.startsWith(ACCESS_TOKEN_PREFIX)).toBe(true);
    expect(a.length).toBe(ACCESS_TOKEN_PREFIX.length + 43);
    expect(a).not.toBe(b);
  });

  it("compares in constant time and handles length differences", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("expiry", () => {
  it("is expired at or after the instant", () => {
    const now = Date.UTC(2026, 9, 28, 12);
    expect(isExpired(new Date(now - 1), now)).toBe(true);
    expect(isExpired(new Date(now), now)).toBe(true);
    expect(isExpired(new Date(now + 1), now)).toBe(false);
  });
});

describe("redirect URI registration", () => {
  it.each([
    "https://claude.ai/api/mcp/auth_callback",
    "https://chatgpt.com/connector_platform_oauth_redirect",
    "http://localhost:33418/callback",
    "http://127.0.0.1:6274/oauth/callback",
    "http://[::1]:8080/cb",
    "cursor://anysphere.cursor-retrieval/oauth/user-twinmcp/callback",
    "vscode://vscode.github-authentication/did-authenticate",
  ])("accepts %s", (uri) => {
    expect(validateRedirectUri(uri)).toEqual({ ok: true });
  });

  it.each([
    ["http://evil.example/callback", "http only on loopback"],
    ["javascript:alert(1)", "scheme javascript: not allowed"],
    ["data:text/html,hi", "scheme data: not allowed"],
    ["file:///etc/passwd", "scheme file: not allowed"],
    ["https://claude.ai/cb#frag", "fragment not allowed"],
    ["https://user:pw@claude.ai/cb", "credentials not allowed"],
    ["/relative/path", "not an absolute URL"],
    ["https://claude.ai/a b", "invalid characters"],
    ["https://claude.ai\\@evil.example/", "invalid characters"],
    ["myapp://callback", "scheme myapp: not allowed"],
  ])("rejects %s", (uri, reason) => {
    expect(validateRedirectUri(uri)).toEqual({ ok: false, reason });
  });

  it("rejects non-strings and huge values", () => {
    expect(validateRedirectUri(42).ok).toBe(false);
    expect(validateRedirectUri("").ok).toBe(false);
    expect(validateRedirectUri(`https://a.fr/${"x".repeat(2100)}`).ok).toBe(false);
  });
});

describe("redirect URI matching", () => {
  const registered = ["https://claude.ai/api/mcp/auth_callback", "http://127.0.0.1:33418/cb"];

  it("matches exactly", () => {
    expect(redirectUriMatches(registered, "https://claude.ai/api/mcp/auth_callback")).toBe(true);
  });

  it("refuses prefixes, suffixes, other hosts and case changes", () => {
    expect(redirectUriMatches(registered, "https://claude.ai/api/mcp/auth_callback/x")).toBe(false);
    expect(redirectUriMatches(registered, "https://claude.ai/api/mcp/auth_callback?x=1")).toBe(
      false
    );
    expect(
      redirectUriMatches(registered, "https://claude.ai.evil.example/api/mcp/auth_callback")
    ).toBe(false);
    expect(redirectUriMatches(registered, "https://CLAUDE.ai/api/mcp/auth_callback")).toBe(false);
    expect(redirectUriMatches(registered, "")).toBe(false);
  });

  it("lets a loopback redirect change only its port (RFC 8252 §7.3)", () => {
    expect(redirectUriMatches(registered, "http://127.0.0.1:50123/cb")).toBe(true);
    expect(redirectUriMatches(registered, "http://127.0.0.1:50123/other")).toBe(false);
    expect(redirectUriMatches(registered, "http://localhost:33418/cb")).toBe(false);
    expect(redirectUriMatches(registered, "https://127.0.0.1:33418/cb")).toBe(false);
  });
});

describe("resource indicator (RFC 8707)", () => {
  it("accepts absence, the origin and MCP paths; extracts the server slug", () => {
    expect(parseResource(null, ORIGINS)).toEqual({ ok: true, resource: null, serverSlug: null });
    expect(parseResource("https://twinmcp.fr", ORIGINS)).toMatchObject({
      ok: true,
      serverSlug: null,
    });
    expect(parseResource("https://twinmcp.fr/api/mcp", ORIGINS)).toMatchObject({
      ok: true,
      serverSlug: null,
    });
    expect(parseResource("https://twinmcp.fr/api/mcp/acme", ORIGINS)).toMatchObject({
      ok: true,
      serverSlug: "acme",
    });
    expect(parseResource("https://twinmcp.fr/api/mcp/acme/github/", ORIGINS)).toMatchObject({
      ok: true,
      serverSlug: "acme",
    });
  });

  it("rejects other origins, other paths and fragments", () => {
    expect(parseResource("https://evil.example/api/mcp/acme", ORIGINS).ok).toBe(false);
    expect(parseResource("https://twinmcp.fr/dashboard", ORIGINS).ok).toBe(false);
    expect(parseResource("https://twinmcp.fr/api/mcp/acme#x", ORIGINS).ok).toBe(false);
    expect(parseResource("not a url", ORIGINS).ok).toBe(false);
  });
});

function params(overrides: Partial<AuthorizeParams> = {}): AuthorizeParams {
  return {
    clientId: "tmcp_client_x",
    redirectUri: "https://claude.ai/api/mcp/auth_callback",
    responseType: "code",
    codeChallenge: RFC_CHALLENGE,
    codeChallengeMethod: "S256",
    state: "xyz",
    scope: "",
    resource: "https://twinmcp.fr/api/mcp/acme",
    ...overrides,
  };
}

describe("authorize request checks", () => {
  it("accepts a well-formed request", () => {
    expect(checkAuthorizeParams(params(), ORIGINS)).toEqual({
      ok: true,
      serverSlug: "acme",
      resource: "https://twinmcp.fr/api/mcp/acme",
    });
  });

  it("requires response_type=code and PKCE S256", () => {
    expect(checkAuthorizeParams(params({ responseType: "token" }), ORIGINS)).toMatchObject({
      ok: false,
      error: "unsupported_response_type",
    });
    expect(checkAuthorizeParams(params({ codeChallenge: "" }), ORIGINS)).toMatchObject({
      ok: false,
      error: "invalid_request",
    });
    expect(checkAuthorizeParams(params({ codeChallengeMethod: "plain" }), ORIGINS)).toMatchObject({
      ok: false,
      error: "invalid_request",
    });
    expect(checkAuthorizeParams(params({ codeChallengeMethod: "" }), ORIGINS)).toMatchObject({
      ok: false,
    });
    expect(checkAuthorizeParams(params({ codeChallenge: "abc" }), ORIGINS)).toMatchObject({
      ok: false,
    });
  });

  it("rejects a foreign resource with invalid_target", () => {
    expect(
      checkAuthorizeParams(params({ resource: "https://evil.example/api/mcp/acme" }), ORIGINS)
    ).toMatchObject({ ok: false, error: "invalid_target" });
  });

  it("round-trips through a query string", () => {
    const p = params({ state: "a b&c=d" });
    const q = new URLSearchParams(authorizeQuery(p));
    expect(readAuthorizeParams((n) => q.get(n))).toEqual(p);
  });

  it("truncates oversized values", () => {
    const p = readAuthorizeParams((n) => (n === "state" ? "s".repeat(5000) : null));
    expect(p.state.length).toBe(1024);
  });

  it("normalizes any requested scope to mcp", () => {
    expect(normalizeScope(undefined)).toBe("mcp");
    expect(normalizeScope("mcp.read mcp.write openid")).toBe("mcp");
  });
});

describe("authorization response redirect", () => {
  it("keeps existing query params and adds code, state and iss", () => {
    const url = buildRedirect("https://app.example/cb?x=1", {
      code: "c",
      state: "s",
      iss: "https://twinmcp.fr",
      empty: "",
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://app.example/cb");
    expect(u.searchParams.get("x")).toBe("1");
    expect(u.searchParams.get("code")).toBe("c");
    expect(u.searchParams.get("state")).toBe("s");
    expect(u.searchParams.get("iss")).toBe("https://twinmcp.fr");
    expect(u.searchParams.has("empty")).toBe(false);
  });

  it("labels the redirect target by host or scheme", () => {
    expect(redirectTargetLabel("https://claude.ai/api/mcp/auth_callback")).toBe("claude.ai");
    expect(redirectTargetLabel("http://127.0.0.1:33418/cb")).toBe("127.0.0.1:33418");
    expect(redirectTargetLabel("cursor://anysphere.cursor-retrieval/cb")).toBe(
      "cursor://anysphere.cursor-retrieval"
    );
  });
});

describe("dynamic client registration", () => {
  it("accepts a minimal public client", () => {
    expect(
      validateRegistration({
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      })
    ).toEqual({
      ok: true,
      clientName: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      clientUri: null,
    });
  });

  it("requires valid redirect URIs (1..10)", () => {
    expect(validateRegistration({}).ok).toBe(false);
    expect(validateRegistration({ redirect_uris: [] }).ok).toBe(false);
    expect(validateRegistration({ redirect_uris: ["http://evil.example/cb"] })).toMatchObject({
      ok: false,
      error: "invalid_redirect_uri",
    });
    const many = Array.from({ length: 11 }, (_, i) => `https://a.fr/${i}`);
    expect(validateRegistration({ redirect_uris: many }).ok).toBe(false);
  });

  it("refuses unsupported grant and response types", () => {
    const base = { redirect_uris: ["https://a.fr/cb"] };
    expect(validateRegistration({ ...base, grant_types: ["client_credentials"] })).toMatchObject({
      ok: false,
      error: "invalid_client_metadata",
    });
    expect(validateRegistration({ ...base, response_types: ["token"] })).toMatchObject({
      ok: false,
      error: "invalid_client_metadata",
    });
  });

  it("sanitizes the name and keeps only an https client_uri", () => {
    const r = validateRegistration({
      redirect_uris: ["https://a.fr/cb", "https://a.fr/cb"],
      client_name: `  Evil\u0000App${"x".repeat(200)}`,
      client_uri: "javascript:alert(1)",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clientName.startsWith("EvilApp")).toBe(true);
      expect(r.clientName.length).toBe(100);
      expect(r.clientUri).toBeNull();
      expect(r.redirectUris).toEqual(["https://a.fr/cb"]);
    }
    const named = validateRegistration({ redirect_uris: ["https://a.fr/cb"] });
    expect(named.ok && named.clientName).toBe("MCP client");
  });
});

describe("discovery metadata", () => {
  it("advertises only S256, public clients and the endpoints", () => {
    const m = buildAuthorizationServerMetadata("https://twinmcp.fr");
    expect(m.issuer).toBe("https://twinmcp.fr");
    expect(m.authorization_endpoint).toBe("https://twinmcp.fr/oauth/authorize");
    expect(m.token_endpoint).toBe("https://twinmcp.fr/oauth/token");
    expect(m.registration_endpoint).toBe("https://twinmcp.fr/oauth/register");
    expect(m.revocation_endpoint).toBe("https://twinmcp.fr/oauth/revoke");
    expect(m.code_challenge_methods_supported).toEqual(["S256"]);
    expect(m.token_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(m.authorization_response_iss_parameter_supported).toBe(true);
  });

  it("describes the proxy root and one endpoint", () => {
    expect(buildProtectedResourceMetadata("https://twinmcp.fr", "")).toMatchObject({
      resource: "https://twinmcp.fr/api/mcp",
      authorization_servers: ["https://twinmcp.fr"],
    });
    expect(buildProtectedResourceMetadata("https://twinmcp.fr", "/api/mcp/acme").resource).toBe(
      "https://twinmcp.fr/api/mcp/acme"
    );
  });

  it("only path-inserts MCP endpoint paths", () => {
    expect(isMcpResourcePath("/api/mcp")).toBe(true);
    expect(isMcpResourcePath("/api/mcp/acme")).toBe(true);
    expect(isMcpResourcePath("/api/mcp/acme/github")).toBe(true);
    expect(isMcpResourcePath("/api/mcp/acme/github/x")).toBe(false);
    expect(isMcpResourcePath("/api/v2/account")).toBe(false);
    expect(isMcpResourcePath("/api/mcp/a b")).toBe(false);
    expect(protectedResourceMetadataUrl("https://twinmcp.fr", "/api/mcp/acme/")).toBe(
      "https://twinmcp.fr/.well-known/oauth-protected-resource/api/mcp/acme"
    );
    expect(protectedResourceMetadataUrl("https://twinmcp.fr", "/elsewhere")).toBe(
      "https://twinmcp.fr/.well-known/oauth-protected-resource"
    );
  });
});

describe("WWW-Authenticate", () => {
  it("points to the resource metadata when OAuth is on", () => {
    expect(
      wwwAuthenticateValue({
        issuer: "https://twinmcp.fr",
        pathname: "/api/mcp/acme",
        hadToken: false,
        enabled: true,
      })
    ).toBe(
      'Bearer realm="twinmcp", resource_metadata="https://twinmcp.fr/.well-known/oauth-protected-resource/api/mcp/acme", scope="mcp"'
    );
  });

  it("adds invalid_token when a token was sent, and stays API-key only when off", () => {
    expect(
      wwwAuthenticateValue({
        issuer: "https://twinmcp.fr",
        pathname: "/api/mcp/acme",
        hadToken: true,
        enabled: true,
      })
    ).toContain('error="invalid_token"');
    expect(
      wwwAuthenticateValue({
        issuer: "https://twinmcp.fr",
        pathname: "/api/mcp/acme",
        hadToken: false,
        enabled: false,
      })
    ).toBe('Bearer realm="twinmcp", error="invalid_token"');
  });

  it("reads the path and Authorization header from a request", () => {
    const prev = process.env.OAUTH_DISABLED;
    delete process.env.OAUTH_DISABLED;
    try {
      const anon = wwwAuthenticateHeader(new Request("https://twinmcp.fr/api/mcp/acme/github"));
      expect(anon).toContain("/.well-known/oauth-protected-resource/api/mcp/acme/github");
      expect(anon).not.toContain("invalid_token");
      const bad = wwwAuthenticateHeader(
        new Request("https://twinmcp.fr/api/mcp/acme", {
          headers: { authorization: "Bearer tmcp_at_nope" },
        })
      );
      expect(bad).toContain('error="invalid_token"');
    } finally {
      if (prev !== undefined) process.env.OAUTH_DISABLED = prev;
    }
  });
});

describe("window limiter", () => {
  it("allows `limit` hits per window, then reports retry-after", () => {
    const l = createWindowLimiter(2, 60_000);
    const t = 1_000_000;
    expect(l.hit("k", t).ok).toBe(true);
    expect(l.hit("k", t + 1).ok).toBe(true);
    const third = l.hit("k", t + 2);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBe(60);
    expect(l.hit("other", t + 2).ok).toBe(true);
    expect(l.hit("k", t + 60_000).ok).toBe(true);
  });

  it("bounds its memory", () => {
    const l = createWindowLimiter(1, 60_000, 3);
    for (let i = 0; i < 10; i++) expect(l.hit(`k${i}`, 0).ok).toBe(true);
  });
});
