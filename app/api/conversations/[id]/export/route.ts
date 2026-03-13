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
    if (!userId) throw new AuthenticationError();

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

    // Whitelist safe export options to prevent mass assignment
    const safeOptions = {
      includeMetadata: options?.includeMetadata === true,
      includeAnalytics: options?.includeAnalytics === true,
      includeAttachments: options?.includeAttachments !== false,
      compressImages: options?.compressImages === true,
    };

    const exportRecord = await conversationService.exportConversation(
      conversationId,
      userId,
      format,
      safeOptions
    );

    return NextResponse.json({ export: exportRecord }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'ExportConversation');
  }
}
