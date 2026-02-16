import { NextRequest, NextResponse } from 'next/server';

/**
 * Global Auth Middleware
 * Runs on the Edge Runtime for all matched routes.
 * - Public routes are allowed through without auth.
 * - Protected API routes require a valid Bearer token or x-api-key header.
 * - JWT signature is verified using the Web Crypto API (Edge-compatible).
 */

// ─── Routes that do NOT require authentication ───────────────────
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/create-checkout-session',
  '/api/webhooks',
  '/api/health',
  '/api/ready',
  '/api/v1/mcp/health',
  '/api/monitoring/health',
];

const PUBLIC_PREFIXES = [
  '/api/webhooks/',
  '/api/public/',
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

  // Allow public API routes
  if (isPublicRoute(pathname)) {
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
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('[Middleware] JWT_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error', code: 'SERVER_ERROR' },
        { status: 500 },
      );
    }

    const valid = await verifyJWT(token, secret);
    if (valid) {
      return NextResponse.next();
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
