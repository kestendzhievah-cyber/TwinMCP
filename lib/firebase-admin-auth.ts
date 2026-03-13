import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

/**
 * Shared Firebase Admin auth helper — singleton initialization.
 * Avoids re-initializing firebase-admin on every API route call.
 */

let _adminAuth: any = null;
let _initPromise: Promise<any> | null = null;

function isFirebaseAdminConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  );
}

async function initFirebaseAdmin() {
  if (_adminAuth) return _adminAuth;

  if (!isFirebaseAdminConfigured()) return null;

  try {
    const firebaseAdmin = await import('firebase-admin');

    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      });
    }

    _adminAuth = firebaseAdmin.auth();
    return _adminAuth;
  } catch (error) {
    logger.error('Firebase Admin init failed:', error);
    return null;
  }
}

/**
 * Get the Firebase Admin Auth instance (lazy singleton).
 * Returns null if Firebase Admin is not configured.
 */
export async function getFirebaseAdminAuth() {
  if (_adminAuth) return _adminAuth;
  if (!_initPromise) {
    _initPromise = initFirebaseAdmin();
  }
  return _initPromise;
}

/**
 * Extract user ID from a Firebase JWT token payload (unverified).
 * Used as dev fallback only.
 */
export function extractUserIdFromToken(token: string): { userId: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const userId = payload.user_id || payload.sub || payload.uid;

    if (!userId) return null;

    return { userId, email: payload.email };
  } catch {
    return null;
  }
}

// SECURITY: Triple-guard dev auth fallback — must be non-production AND explicitly opted-in
// AND the DATABASE_URL must point to localhost (prevents accidental activation on staging)
const ALLOW_INSECURE_DEV_AUTH =
  process.env.NODE_ENV !== 'production' &&
  process.env.ALLOW_INSECURE_DEV_AUTH === 'true' &&
  (process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') || false);

/**
 * Validate auth from a request — tries Firebase Admin first, then dev fallback.
 */
export async function validateAuth(
  authHeader: string | null
): Promise<{ valid: true; userId: string; email?: string } | { valid: false; error: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'No authentication provided' };
  }

  const token = authHeader.substring(7);

  // Try Firebase Admin verification
  const adminAuth = await getFirebaseAdminAuth();
  if (adminAuth) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      return { valid: true, userId: decodedToken.uid, email: decodedToken.email };
    } catch {
      logger.warn('Firebase Admin verification failed, trying fallback');
    }
  }

  // Dev fallback
  if (ALLOW_INSECURE_DEV_AUTH) {
    const extracted = extractUserIdFromToken(token);
    if (extracted) {
      logger.warn('Using insecure dev auth fallback (unverified JWT payload).');
      return { valid: true, userId: extracted.userId, email: extracted.email };
    }
  }

  return { valid: false, error: 'Invalid or expired token' };
}

/**
 * Validate auth with API key fallback — tries Firebase Admin, dev fallback, then API key hash lookup.
 * Use this for routes that accept both Firebase JWT and twinmcp_ API keys.
 */
export async function validateAuthWithApiKey(
  authHeader: string | null,
  apiKeyHeader: string | null
): Promise<
  { valid: true; userId: string; email?: string; tier?: string } | { valid: false; error: string }
> {
  // 1) Try Firebase JWT first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Skip Firebase verification if token is an API key
    if (!token.startsWith('twinmcp_')) {
      const adminAuth = await getFirebaseAdminAuth();
      if (adminAuth) {
        try {
          const decodedToken = await adminAuth.verifyIdToken(token);
          return { valid: true, userId: decodedToken.uid, email: decodedToken.email };
        } catch {
          logger.warn('Firebase Admin verification failed, trying fallbacks');
        }
      }

      // Dev fallback
      if (ALLOW_INSECURE_DEV_AUTH) {
        const extracted = extractUserIdFromToken(token);
        if (extracted) {
          logger.warn('Using insecure dev auth fallback (unverified JWT payload).');
          return { valid: true, userId: extracted.userId, email: extracted.email };
        }
      }
    }

    // Try as API key if it's a twinmcp_ token
    if (token.startsWith('twinmcp_')) {
      return _validateApiKeyHash(token);
    }
  }

  // 2) Try x-api-key header
  if (apiKeyHeader) {
    return _validateApiKeyHash(apiKeyHeader);
  }

  return { valid: false, error: 'No authentication provided' };
}

async function _validateApiKeyHash(
  apiKey: string
): Promise<{ valid: true; userId: string; tier?: string } | { valid: false; error: string }> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // findUnique by keyHash is an exact match — no timing attack vector on the DB index lookup
    const key = await prisma.apiKey.findUnique({ where: { keyHash } });

    if (!key || !key.isActive || key.revokedAt) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Update lastUsedAt (fire-and-forget, non-blocking)
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { valid: true, userId: key.userId, tier: key.tier };
  } catch (error) {
    logger.error('API key validation error:', error);
    return { valid: false, error: 'Authentication failed' };
  }
}

/**
 * Simple helper that returns just the userId string or null.
 * For routes that only need the user ID and handle error responses themselves.
 */
export async function getAuthUserId(authHeader: string | null): Promise<string | null> {
  const result = await validateAuth(authHeader);
  return result.valid ? result.userId : null;
}
