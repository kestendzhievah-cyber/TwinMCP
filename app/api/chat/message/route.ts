import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { prisma } from '@/lib/prisma';
import { generateResponse } from '@/lib/services/llm-gateway.service';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, message, options = {} } = body;

    if (!conversationId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the conversation belongs to this user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Persist user message
    try {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: message,
        },
      });
    } catch (e) {
      logger.warn('Failed to persist user message:', e);
    }

    // Generate the response
    const response = await generateResponse(message, options);

    const messageId = crypto.randomUUID();

    // Persist assistant message + track usage (fire-and-forget)
    Promise.all([
      prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: response.content,
        },
      }),
      prisma.usageLog.create({
        data: {
          userId,
          toolName: `chat/message:${response.metadata.provider}:${response.metadata.model}`,
          tokensReturned: response.metadata.totalTokens || 0,
          responseTimeMs: response.metadata.latency || 0,
          success: true,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]).catch(e => logger.warn('Failed to persist message/usage:', e));

    return NextResponse.json({
      id: messageId,
      content: response.content,
      metadata: response.metadata,
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
