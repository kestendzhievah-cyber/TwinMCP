import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth';

// DELETE - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateAuthWithApiKey(request.headers.get('authorization'), request.headers.get('x-api-key'));
  const auth = authResult.valid ? { userId: authResult.userId } : null;
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
  const authResult = await validateAuthWithApiKey(request.headers.get('authorization'), request.headers.get('x-api-key'));
  const auth = authResult.valid ? { userId: authResult.userId } : null;
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
