import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

// Validate auth header
async function validateAuthHeader(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  // Mock for demo
  return { userId: 'demo-user-id' };
}

// DELETE - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateAuthHeader(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: params.id, userId: auth.userId },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id: params.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

// PATCH - Update API key (name, tier, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateAuthHeader(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, isActive } = body;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id: params.id, userId: auth.userId },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const updated = await prisma.apiKey.update({
      where: { id: params.id },
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
    console.error('Failed to update API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}
