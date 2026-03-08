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
    const { role, content, metadata, attachments } = body;
    const conversationId = (await params).id;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: role, content' },
        { status: 400 }
      );
    }

    const message = await conversationService.addMessage(conversationId, userId, {
      role,
      content,
      metadata: metadata || {},
      attachments: attachments || [],
      timestamp: new Date(),
      reactions: [],
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    logger.error('Error adding message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const conversationService = await getConversationService();
    const conversationId = (await params).id;

    const conversation = await conversationService.getConversation(
      conversationId,
      userId
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ messages: conversation.messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
