import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversationService = await getConversationService();
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

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
    logger.error('Error sharing conversation:', error);
    return NextResponse.json({ error: 'Failed to share conversation' }, { status: 500 });
  }
}
