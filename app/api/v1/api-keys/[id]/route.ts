import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

const ALLOW_INSECURE_DEV_AUTH =
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_DEV_AUTH === 'true';

// Extract user ID from Firebase JWT token
function extractUserIdFromToken(token: string): { userId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const userId = payload.user_id || payload.sub || payload.uid;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

// Validate auth header — Firebase Admin → JWT extraction → API key fallback
async function validateAuthHeader(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);

  // Try Firebase Admin if configured
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const firebaseAdmin = await import('firebase-admin');
      if (!firebaseAdmin.apps.length) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      }
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      return { userId: decodedToken.uid };
    } catch {
      // fall through
    }
  }

  // Fallback is explicitly allowed only in non-production development flows
  if (ALLOW_INSECURE_DEV_AUTH) {
    const extracted = extractUserIdFromToken(token);
    if (extracted) {
      logger.warn('Using insecure dev auth fallback (unverified JWT payload).');
      return extracted;
    }
  }

  // Try as API key
  try {
    const keyHash = createHash('sha256').update(token).digest('hex');
    const key = await prisma.apiKey.findFirst({
      where: { keyHash, isActive: true, revokedAt: null },
    });
    if (key) return { userId: key.userId };
  } catch { /* ignore */ }

  return null;
}

// DELETE - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAuthHeader(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'API key revoked successfully' });
  } catch (error) {
    logger.error('Failed to revoke API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

// PATCH - Update API key (name, tier, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAuthHeader(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, isActive } = body;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(typeof isActive === 'boolean' && { isActive }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        tier: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ apiKey: updated });
  } catch (error) {
    logger.error('Failed to update API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}
