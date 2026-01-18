import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/services/conversation.service';

// Initialisation du service (à adapter avec votre configuration DB/Redis)
const conversationService = new ConversationService(
  // @ts-ignore - Pool PostgreSQL
  null,
  // @ts-ignore - Redis
  null
);

export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    const shareId = params.shareId;

    const conversation = await conversationService.getSharedConversation(shareId);
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Shared conversation not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error fetching shared conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared conversation' },
      { status: 500 }
    );
  }
}
