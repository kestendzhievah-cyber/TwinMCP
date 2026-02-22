import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
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
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, provider, model, userId } = body;

    if (!title || !provider || !model || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
