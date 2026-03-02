import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createConversationSchema, parseBody } from '@/lib/validations/api-schemas';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({ success: true, data: conversations });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }
    const parsed = parseBody(createConversationSchema, rawBody);
    const title = parsed.success ? parsed.data.title : undefined;

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: title || 'Nouvelle conversation',
      }
    });

    return NextResponse.json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
