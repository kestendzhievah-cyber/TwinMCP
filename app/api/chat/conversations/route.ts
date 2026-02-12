import { NextRequest, NextResponse } from 'next/server';

interface ChatConversation {
  id: string;
  title: string;
  messages: any[];
  metadata: {
    userId: string;
    provider: string;
    model: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
  };
  settings: {
    temperature: number;
    maxTokens: number;
    streamResponse: boolean;
    includeContext: boolean;
    contextSources: string[];
    autoSave: boolean;
    shareEnabled: boolean;
  };
}

// Mock database - remplacer avec une vraie base de données
const conversations: Map<string, ChatConversation> = new Map();

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Récupérer les conversations de l'utilisateur
    const userConversations = Array.from(conversations.values())
      .filter(conv => conv.metadata.userId === userId)
      .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());

    return NextResponse.json({ conversations: userConversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
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

    const newConversation: ChatConversation = {
      id: crypto.randomUUID(),
      title,
      messages: [],
      metadata: {
        userId,
        provider,
        model,
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0
      },
      settings: {
        temperature: 0.7,
        maxTokens: 2048,
        streamResponse: true,
        includeContext: false,
        contextSources: [],
        autoSave: true,
        shareEnabled: false
      }
    };

    conversations.set(newConversation.id, newConversation);

    return NextResponse.json({ conversation: newConversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
