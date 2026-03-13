import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// DELETE - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateAuthWithApiKey(
      request.headers.get('authorization'),
      request.headers.get('x-api-key')
    );
    if (!authResult.valid) throw new AuthenticationError();
    const userId = authResult.userId;

    const { id } = await params;
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId },
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
    return handleApiError(error, 'RevokeApiKey');
  }
}

// PATCH - Update API key (name, tier, etc.)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await validateAuthWithApiKey(
      request.headers.get('authorization'),
      request.headers.get('x-api-key')
    );
    if (!authResult.valid) throw new AuthenticationError();
    const userId = authResult.userId;

    const { id } = await params;
    const body = await request.json();
    // Whitelist safe fields
    const name = typeof body.name === 'string' ? body.name : undefined;
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(isActive !== undefined && { isActive }),
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
    return handleApiError(error, 'UpdateApiKey');
  }
}
