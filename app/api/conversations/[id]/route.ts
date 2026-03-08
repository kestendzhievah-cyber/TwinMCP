import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversationService = await getConversationService();
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const conversationId = (await params).id;

    const conversation = await conversationService.getConversation(
      conversationId,
      userId
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const conversationService = await getConversationService();
    const body = await request.json();
    const { updates } = body;
    const conversationId = (await params).id;

    const conversation = await conversationService.updateConversation(
      conversationId,
      userId,
      updates
    );

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const conversationId = (await params).id;

    const conversationService = await getConversationService();
    // Verify ownership before deleting
    const conversation = await conversationService.getConversation(conversationId, userId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // TODO: Implement deleteConversation in the service
    // await conversationService.deleteConversation(conversationId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
