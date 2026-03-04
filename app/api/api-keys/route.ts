import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth';
import {
  ensureUser,
  getUserTier,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  sanitizeKeyName,
} from '@/lib/services/api-key.service';

// ─── Auth: shared Firebase Admin singleton + API key fallback ───
async function authenticateRequest(
  request: NextRequest
): Promise<{ userId: string; email?: string } | null> {
  const result = await validateAuthWithApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key')
  );
  return result.valid ? { userId: result.userId, email: result.email } : null;
}

// ─── GET: List user's API keys with real usage stats ───
export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await ensureUser(auth.userId, auth.email);
    const tier = await getUserTier(user.id);
    const { keys, limits } = await listApiKeys(user.id, tier);

    return NextResponse.json(
      {
        success: true,
        data: keys,
        subscription: { plan: tier, limits },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=5',
          'X-Response-Time': `${Date.now() - start}ms`,
        },
      }
    );
  } catch (error) {
    logger.error('List API keys error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── POST: Create new API key (transaction-safe, no race condition) ───
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await ensureUser(auth.userId, auth.email);
    const tier = await getUserTier(user.id);

    // Parse body
    let rawBody: Record<string, unknown>;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    // Sanitize name (strips HTML tags, enforces length)
    const nameResult = sanitizeKeyName(rawBody?.name);
    if (!nameResult.valid) {
      return NextResponse.json(
        { success: false, error: nameResult.error },
        { status: 400 }
      );
    }

    // Atomic create inside transaction (prevents race condition on key count)
    const result = await createApiKey(user.id, nameResult.name, tier);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.apiKey.id,
        key: result.apiKey.rawKey,
        keyPrefix: result.apiKey.keyPrefix,
        name: result.apiKey.name,
        tier: result.apiKey.tier,
        quotaRequestsPerDay: result.apiKey.quotaRequestsPerDay,
        quotaRequestsPerMinute: result.apiKey.quotaRequestsPerMinute,
        createdAt: result.apiKey.createdAt,
        usage: result.apiKey.usage,
      },
      warning: 'Sauvegardez cette clé maintenant. Elle ne sera plus affichée.',
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── DELETE: Revoke API key (by ?id= query param) ───
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await ensureUser(auth.userId, auth.email);

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'Key ID is required (?id=...)' },
        { status: 400 }
      );
    }

    const result = await revokeApiKey(keyId, user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'API key revoked successfully' });
  } catch (error) {
    logger.error('Revoke API key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
