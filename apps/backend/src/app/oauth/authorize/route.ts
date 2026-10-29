import { randomBytes } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import { requireSessionUser } from "@/lib/session";
import { trustedClientIp } from "@/lib/net/client-ip";
import {
  CONSENT_CSRF_COOKIE,
  CONSENT_CSRF_MAX_AGE,
  allowedResourceOrigins,
  authorizeQuery,
  buildRedirect,
  createAuthorizationCode,
  isOAuthEnabled,
  normalizeScope,
  oauthAudit,
  oauthIssuer,
  readAuthorizeParams,
  redirectTargetLabel,
  resolveAuthorize,
  safeEqual,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Authorization endpoint.
//
//   GET   validates the request. ANY error → the consent page shows it, never
//         an automatic redirect: registration is open, so an "error redirect"
//         to a freshly registered URI would make twinmcp.fr an open redirector
//         (RFC 9700 §4.11.2). The page offers a plain link back to the app.
//         Not signed in → /sign-in?returnTo=… (same-origin path). Signed in → a
//         CSRF cookie is set and the browser lands on /oauth/consent.
//   POST  the consent form: CSRF double-submit (cookie == hidden field,
//         constant-time) + Origin / Sec-Fetch-Site check, a browser session
//         (not an API key), the request re-validated from scratch, and the
//         chosen server re-checked for ownership. Allow → 60 s single-use code.
//         The only automatic redirects to the client are the answers to an
//         explicit, CSRF-checked decision: the code (Allow) or access_denied.

const CSRF_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

/** A relative 303 (browsers resolve it against the current origin). */
function seeOther(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

function consentPath(query: string) {
  return `/oauth/consent${query ? `?${query}` : ""}`;
}

function errorRedirect(redirectUri: string, error: string, description: string, state: string) {
  return seeOther(
    buildRedirect(redirectUri, {
      error,
      error_description: description,
      state,
      iss: oauthIssuer(),
    })
  );
}

export async function GET(req: NextRequest) {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const p = readAuthorizeParams((n) => url.searchParams.get(n));
  const r = await resolveAuthorize(p);
  // Errors are rendered by the consent page, never redirected automatically
  // (open-redirect proof, see above).
  if (r.kind !== "ok") return seeOther(consentPath(authorizeQuery(p)));

  const query = authorizeQuery(r.params);
  const user = await requireSessionUser(req);
  if (!user || user.apiKey) {
    const returnTo = `/oauth/authorize?${query}`;
    return seeOther(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const res = seeOther(consentPath(query));
  const existing = req.cookies.get(CONSENT_CSRF_COOKIE)?.value ?? "";
  res.cookies.set(CONSENT_CSRF_COOKIE, CSRF_PATTERN.test(existing) ? existing : newCsrf(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/oauth",
    maxAge: CONSENT_CSRF_MAX_AGE,
  });
  return res;
}

function newCsrf(): string {
  return randomBytes(32).toString("base64url");
}

function formString(form: FormData, name: string): string | null {
  const v = form.get(name);
  return typeof v === "string" ? v : null;
}

/** Same-origin form post only (Origin when the browser sends it, else Sec-Fetch-Site). */
function isSameOriginPost(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set([req.nextUrl.origin, ...allowedResourceOrigins()]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) allowed.add(`https://${host.split(",")[0].trim()}`);
  return allowed.has(origin);
}

export async function POST(req: NextRequest) {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });
  if (!isSameOriginPost(req)) {
    return NextResponse.json({ message: "Cross-site request refused" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form" }, { status: 400 });
  }
  const p = readAuthorizeParams((n) => formString(form, n));
  const query = authorizeQuery(p);

  // CSRF: the hidden field must equal the httpOnly cookie set by GET. On a
  // mismatch (expired cookie, other tab) restart the flow — the user sees the
  // consent screen again; nothing is granted.
  const cookieCsrf = req.cookies.get(CONSENT_CSRF_COOKIE)?.value ?? "";
  const formCsrf = formString(form, "csrf") ?? "";
  if (!CSRF_PATTERN.test(cookieCsrf) || !safeEqual(cookieCsrf, formCsrf)) {
    return seeOther(`/oauth/authorize?${query}`);
  }

  const user = await requireSessionUser(req);
  if (!user || user.apiKey) {
    return seeOther(`/sign-in?returnTo=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const r = await resolveAuthorize(p);
  // An invalid request is shown, not redirected, before the user's decision.
  if (r.kind !== "ok") return seeOther(consentPath(query));

  const clearCsrf = (res: NextResponse) => {
    res.cookies.set(CONSENT_CSRF_COOKIE, "", { path: "/oauth", maxAge: 0 });
    return res;
  };

  if (formString(form, "decision") !== "allow") {
    return clearCsrf(
      errorRedirect(r.redirectUri, "access_denied", "The user denied access", p.state)
    );
  }

  // The server the connector may reach: one the user owns, or all of them.
  const choice = formString(form, "server") ?? "";
  let serverId: string | null = null;
  if (choice !== "all") {
    const [srv] = await getDb()
      .select({ id: servers.id })
      .from(servers)
      .where(
        and(
          eq(servers.id, choice),
          eq(servers.userId, user.userId),
          ne(servers.status, "destroyed")
        )
      )
      .limit(1);
    if (!srv) return seeOther(consentPath(query));
    serverId = srv.id;
  }

  const code = await createAuthorizationCode({
    clientRowId: r.client.id,
    userId: user.userId,
    serverId,
    redirectUri: r.redirectUri,
    codeChallenge: r.params.codeChallenge,
    scope: normalizeScope(r.params.scope),
    resource: r.resource,
  });
  oauthAudit(
    user.userId,
    "oauth.authorize",
    r.client.id,
    {
      clientName: r.client.clientName,
      redirectTo: redirectTargetLabel(r.redirectUri),
      serverId,
      userAgent: req.headers.get("user-agent"),
    },
    trustedClientIp(req)
  );
  return clearCsrf(
    seeOther(buildRedirect(r.redirectUri, { code, state: p.state, iss: oauthIssuer() }))
  );
}
