import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from '../../_shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const conversationService = await getConversationService();
  try {
    const body = await request.json();
    const { userId, format, options } = body;
    const conversationId = (await params).id;

    if (!userId || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, format' },
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

    const exportRecord = await conversationService.exportConversation(conversationId, userId, format, {
      includeMetadata: true,
      includeAnalytics: false,
      includeAttachments: true,
      compressImages: false,
      ...options
    });

    return NextResponse.json({ export: exportRecord }, { status: 201 });
  } catch (error) {
    logger.error('Error exporting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to export conversation' },
      { status: 500 }
    );
  }
}
