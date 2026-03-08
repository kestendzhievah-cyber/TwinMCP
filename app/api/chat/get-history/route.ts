import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationHistory } from '@/lib/conversation';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // SECURITY: Verify the conversation belongs to the authenticated user
    const owned = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!owned || owned.userId !== userId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const conversation = await getConversationHistory(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    logger.error('Error getting conversation history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
