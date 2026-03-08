import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
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
    logger.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
    logger.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
