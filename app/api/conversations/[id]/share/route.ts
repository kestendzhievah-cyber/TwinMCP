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
    const { userId, expiresAt, permissions, settings } = body;
    const conversationId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const share = await conversationService.shareConversation(conversationId, userId, {
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      permissions: permissions || {},
      settings: settings || {}
    });

    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    console.error('Error sharing conversation:', error);
    return NextResponse.json(
      { error: 'Failed to share conversation' },
      { status: 500 }
    );
  }
}
