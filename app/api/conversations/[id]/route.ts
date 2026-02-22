import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../_shared';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const conversationService = await getConversationService();
  try {
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

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const conversationService = await getConversationService();
    const body = await request.json();
    const { userId, updates } = body;
    const conversationId = (await params).id;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const conversation = await conversationService.updateConversation(
      conversationId,
      userId,
      updates
    );

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = (await params).id;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Supprimer la conversation (implémenter dans le service)
    // await conversationService.deleteConversation(conversationId, userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
