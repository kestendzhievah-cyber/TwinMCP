import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversationService = await getConversationService();
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
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
    return handleApiError(error, 'GetConversation');
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
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
    return handleApiError(error, 'UpdateConversation');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }
    const conversationId = (await params).id;

    const conversationService = await getConversationService();
    await conversationService.deleteConversation(conversationId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DeleteConversation');
  }
}
