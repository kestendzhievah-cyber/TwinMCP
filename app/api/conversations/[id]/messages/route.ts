import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../../_shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const conversationService = await getConversationService();
  try {
    const body = await request.json();
    const { userId, role, content, metadata, attachments } = body;
    const conversationId = (await params).id;

    if (!userId || !role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, role, content' },
        { status: 400 }
      );
    }

    const message = await conversationService.addMessage(conversationId, userId, {
      role,
      content,
      metadata: metadata || {},
      attachments: attachments || [],
      timestamp: new Date(),
      reactions: []
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    logger.error('Error adding message:', error);
    return NextResponse.json(
      { error: 'Failed to add message' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const conversationService = await getConversationService();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = (await params).id;

    const conversation = await conversationService.getConversation(conversationId, userId || undefined);
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ messages: conversation.messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
