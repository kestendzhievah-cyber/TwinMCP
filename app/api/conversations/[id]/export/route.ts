import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversationService = await getConversationService();
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { format, options } = body;
    const conversationId = (await params).id;

    if (!format) {
      return NextResponse.json(
        { error: 'Missing required field: format' },
        { status: 400 }
      );
    }

    const validFormats = ['json', 'markdown', 'pdf', 'html', 'csv'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    const exportRecord = await conversationService.exportConversation(
      conversationId,
      userId,
      format,
      {
        includeMetadata: true,
        includeAnalytics: false,
        includeAttachments: true,
        compressImages: false,
        ...options,
      }
    );

    return NextResponse.json({ export: exportRecord }, { status: 201 });
  } catch (error) {
    logger.error('Error exporting conversation:', error);
    return NextResponse.json({ error: 'Failed to export conversation' }, { status: 500 });
  }
}
