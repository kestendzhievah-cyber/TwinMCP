import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversationService = await getConversationService();
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
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
    return handleApiError(error, 'AddMessage');
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
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
    return handleApiError(error, 'GetMessages');
  }
}
