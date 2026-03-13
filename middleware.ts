import { NextRequest, NextResponse } from 'next/server';

/**
 * Global Auth Middleware
 * Runs on the Edge Runtime for all matched routes.
 * - Public routes are allowed through without auth.
 * - Protected API routes require a valid Bearer token or x-api-key header.
 * - JWT signature is verified using the Web Crypto API (Edge-compatible).
 */

// ─── Routes that do NOT require authentication (Set for O(1) lookup) ───
const PUBLIC_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/create-checkout-session',
  '/api/webhook',
  '/api/webhooks',
  '/api/health',
  '/api/ready',
  '/api/v1/mcp/health',
  '/api/monitoring/health',
]);

// Routes that handle their own authentication (Firebase tokens verified at route level)
const SELF_AUTH_ROUTES = [
  '/api/admin',
  '/api/auth/me',
  '/api/auth/profile',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/auth/validate-key',
  '/api/api-keys',
  '/api/v1/api-keys',
  '/api/v1/dashboard',
  '/api/v1/analytics',
  '/api/v1/billing',
  '/api/v1/usage',
  '/api/v1/external-mcp',
  '/api/v1/mcp-tools',
  '/api/v1/mcp',
  '/api/libraries',
  '/api/mcp',
  '/api/mcp-configurations',
  '/api/mcp-server',
  '/api/downloads',
  '/api/chatbot',
  '/api/user/limits',
  '/api/billing',
  '/api/conversations',
  '/api/chat',
  '/api/personalization',
  '/api/context',
  '/api/monitoring',
  '/api/analytics',
  '/api/github-monitoring',
  '/api/code/execute',
  '/api/graphql',
  '/api/image/analyze',
  '/api/payment',
  '/api/reporting',
  '/api/share',
  '/api/subscription',
  '/api/test',
  '/api/usage',
  '/api/voice',
  '/api/workspace',
  '/api/account',
];

// Pre-build a Set of exact SELF_AUTH routes for O(1) exact match
const SELF_AUTH_SET = new Set(SELF_AUTH_ROUTES);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return pathname.startsWith('/api/webhooks/') || pathname.startsWith('/api/public/');
}

// ─── JWT verification (Edge-compatible, uses Web Crypto) ─────────
async function verifyJWT(token: string, secret: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // Convert base64url to Uint8Array
    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBytes = Uint8Array.from(atob(signatureStr), (c) => c.charCodeAt(0));

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    if (!valid) return false;

    // Check expiration
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

// ─── Middleware entry point ───────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes (pages, static assets, etc.)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Handle CORS preflight (OPTIONS) requests — no auth required
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204 });
  }

  // Allow public API routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Allow self-authenticating routes (they verify Firebase tokens at route level)
  // Fast path: exact match via Set, then prefix check
  if (SELF_AUTH_SET.has(pathname) || SELF_AUTH_ROUTES.some((route) => pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // Extract credentials
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');

  // API key auth — let the downstream route handler validate the key
  if (apiKey && apiKey.startsWith('twinmcp_')) {
    return NextResponse.next();
  }

  // Bearer token auth
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // API key passed as Bearer token — let route handler validate
    if (token.startsWith('twinmcp_')) {
      return NextResponse.next();
    }

    // Firebase ID tokens are RSA-signed JWTs that cannot be verified with
    // HMAC/JWT_SECRET in Edge middleware. Validate JWT structure and that
    // the header declares an RSA algorithm before letting route-level auth
    // (Firebase Admin SDK) handle full verification.
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const headerJson = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
        const header = JSON.parse(headerJson);
        // Firebase tokens use RS256; only pass through RSA-family algorithms
        if (header.alg && header.alg.startsWith('RS')) {
          return NextResponse.next();
        }
      } catch {
        // Malformed header — fall through to JWT_SECRET verification
      }
    }

    // Short JWTs: verify with JWT_SECRET (custom app-issued tokens)
    const secret = process.env.JWT_SECRET;
    if (secret) {
      const valid = await verifyJWT(token, secret);
      if (valid) {
        return NextResponse.next();
      }
    }

    return NextResponse.json(
      { error: 'Invalid or expired token', code: 'INVALID_TOKEN' },
      { status: 401 },
    );
  }

  // No credentials provided
  return NextResponse.json(
    { error: 'Authentication required', code: 'UNAUTHENTICATED' },
    { status: 401 },
  );
}

// ─── Matcher: only run on API routes ─────────────────────────────
export const config = {
  matcher: '/api/:path*',
};
