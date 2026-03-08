import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getConversationService } from './_shared';
import { Conversation, ConversationSearch } from '@/src/types/conversation.types';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { createFullConversationSchema, parseBody } from '@/lib/validations/api-schemas';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Use authenticated userId — ignore query param to prevent IDOR
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const conversationService = await getConversationService();
    const { searchParams } = new URL(request.url);

    // Paramètres de recherche
    const search: ConversationSearch = {
      query: searchParams.get('query') || '',
      filters: {
        dateRange:
          searchParams.get('startDate') && searchParams.get('endDate')
            ? {
                start: new Date(searchParams.get('startDate')!),
                end: new Date(searchParams.get('endDate')!),
              }
            : undefined,
        providers: searchParams.get('providers')?.split(','),
        tags: searchParams.get('tags')?.split(','),
        isPinned: searchParams.get('isPinned')
          ? searchParams.get('isPinned') === 'true'
          : undefined,
        isArchived: searchParams.get('isArchived')
          ? searchParams.get('isArchived') === 'true'
          : undefined,
      },
      sorting: {
        field: (searchParams.get('sortBy') as any) || 'updatedAt',
        order: (searchParams.get('sortOrder') as any) || 'desc',
      },
      pagination: {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
      },
    };

    const result = await conversationService.searchConversations(userId, search);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'ListConversations');
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Use authenticated userId — ignore body.userId to prevent IDOR
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const conversationService = await getConversationService();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(createFullConversationSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const { title, provider, model, systemPrompt, settings } = parsed.data;

    const conversation = await conversationService.createConversation(userId, {
      title,
      provider,
      model,
      systemPrompt,
      settings,
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'CreateConversation');
  }
}
