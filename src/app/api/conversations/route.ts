import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/services/conversation.service';
import { Conversation, ConversationSearch } from '@/types/conversation.types';

// Initialisation du service (à adapter avec votre configuration DB/Redis)
const conversationService = new ConversationService(
  // @ts-ignore - Pool PostgreSQL
  null,
  // @ts-ignore - Redis
  null
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Paramètres de recherche
    const search: ConversationSearch = {
      query: searchParams.get('query') || '',
      filters: {
        dateRange: searchParams.get('startDate') && searchParams.get('endDate') ? {
          start: new Date(searchParams.get('startDate')!),
          end: new Date(searchParams.get('endDate')!)
        } : undefined,
        providers: searchParams.get('providers')?.split(','),
        tags: searchParams.get('tags')?.split(','),
        isPinned: searchParams.get('isPinned') ? searchParams.get('isPinned') === 'true' : undefined,
        isArchived: searchParams.get('isArchived') ? searchParams.get('isArchived') === 'true' : undefined,
      },
      sorting: {
        field: (searchParams.get('sortBy') as any) || 'updatedAt',
        order: (searchParams.get('sortOrder') as any) || 'desc'
      },
      pagination: {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0')
      }
    };

    const result = await conversationService.searchConversations(userId, search);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, provider, model, systemPrompt, settings } = body;

    if (!userId || !title || !provider || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, provider, model' },
        { status: 400 }
      );
    }

    const conversation = await conversationService.createConversation(userId, {
      title,
      provider,
      model,
      systemPrompt,
      settings
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
