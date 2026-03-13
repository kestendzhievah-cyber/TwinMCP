import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        userId: true,
        metadata: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    const formatted = conversations.map((conv: any) => ({
      id: conv.id,
      title: conv.title,
      metadata: {
        userId: conv.userId,
        ...(conv.metadata as object),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv._count.messages,
      },
      settings: conv.settings,
    }));

    return NextResponse.json({ conversations: formatted });
  } catch (error) {
    return handleApiError(error, 'ChatConversationsList');
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const body = await req.json();
    const { title, provider, model } = body;

    if (!title || !provider || !model) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        title,
        userId,
        metadata: {
          provider,
          model,
          totalTokens: 0,
          totalCost: 0,
        },
        settings: {
          temperature: 0.7,
          maxTokens: 2048,
          streamResponse: true,
          includeContext: false,
          contextSources: [],
          autoSave: true,
          shareEnabled: false,
        },
      },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    return handleApiError(error, 'ChatConversationsCreate');
  }
}
