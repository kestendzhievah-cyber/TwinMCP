import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { isApiHost, apiCorsHeaders } from "@/lib/api-host";

export async function middleware(request: NextRequest) {
  const rawHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = rawHost?.split(",")[0].trim();

  // Force HTTPS. Behind Traefik/Dokploy, TLS terminates at the proxy and the
  // original scheme arrives in x-forwarded-proto. Only an explicit "http" is
  // redirected, so already-secure requests and the internal health check (which
  // sets no such header) are left alone — no redirect loop, no broken probe.
  // HSTS (Strict-Transport-Security) is set in next.config.mjs for subsequent
  // visits; this handles the first/direct http hit.
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (proto === "http" && host) {
    return NextResponse.redirect(
      `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`,
      308
    );
  }

  if (isApiHost(host)) return handleApiHost(request);
  return updateSession(request);
}

// The dedicated API origin (e.g. api.twinmcp.fr) serves ONLY the API, never the
// front-end. Clean paths (/v2, /mcp, /health, /openapi) are mapped onto the
// existing /api/* routes; an already-namespaced /api/* passes through; anything
// else (a front-end route) rewrites to a non-existent /api/<page> and 404s.
// Auth is Bearer-token based, so the cookie-session refresh is skipped here and
// permissive CORS is attached. Inert unless NEXT_PUBLIC_API_URL is set.
function handleApiHost(request: NextRequest): NextResponse {
  const cors = apiCorsHeaders();

  // Preflight — answer here so it never reaches a route.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  const { pathname } = request.nextUrl;
  let res: NextResponse;
  if (pathname.startsWith("/api/")) {
    res = NextResponse.next();
  } else {
    const url = request.nextUrl.clone();
    url.pathname = `/api${pathname}`;
    res = NextResponse.rewrite(url);
  }

  for (const [key, value] of Object.entries(cors)) res.headers.set(key, value);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
