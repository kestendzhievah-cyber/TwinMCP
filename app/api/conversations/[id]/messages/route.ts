import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/src/services/conversation.service';

// Initialisation du service (à adapter avec votre configuration DB/Redis)
const conversationService = new ConversationService(
  // @ts-ignore - Pool PostgreSQL
  null,
  // @ts-ignore - Redis
  null
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { userId, role, content, metadata, attachments } = body;
    const conversationId = params.id;

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
    console.error('Error adding message:', error);
    return NextResponse.json(
      { error: 'Failed to add message' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = params.id;

    const conversation = await conversationService.getConversation(conversationId, userId || undefined);
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ messages: conversation.messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
