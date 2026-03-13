import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversationService = await getConversationService();
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const body = await request.json();
    const { expiresAt, permissions, settings } = body;
    const conversationId = (await params).id;

    const share = await conversationService.shareConversation(conversationId, userId, {
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      permissions: permissions || {},
      settings: settings || {},
    });

    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'ShareConversation');
  }
}
