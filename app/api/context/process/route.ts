import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { ContextQuery, ContextResult } from '@/src/types/context-intelligent.types';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { prisma } from '@/lib/prisma';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

let _svc: { contextService: any; db: any } | null = null;
async function getContextServices() {
  if (!_svc) {
    const { pool: db } = await import('@/lib/prisma');
    const { redis } = await import('@/lib/redis');
    const { ContextIntelligentService } =
      await import('@/src/services/context-intelligent.service');
    const { VectorSearchService } = await import('@/src/services/vector-search.service');
    const { NLPService } = await import('@/src/services/nlp.service');
    const { ContextTemplateEngine } = await import('@/src/services/context-template.service');

    const vectorSearch = new VectorSearchService(db, null as any);
    const nlp = new NLPService();
    const templateEngine = new ContextTemplateEngine();
    const contextService = new ContextIntelligentService(
      db,
      redis,
      vectorSearch,
      nlp,
      templateEngine
    );
    _svc = { contextService, db };
  }
  return _svc;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { contextService } = await getContextServices();
    const body = await request.json();
    const contextQuery: ContextQuery = body;

    // Validation des données
    if (!contextQuery.query || !contextQuery.conversationId || !contextQuery.messageId) {
      return NextResponse.json(
        { error: 'Missing required fields: query, conversationId, messageId' },
        { status: 400 }
      );
    }

    // Traitement du contexte
    const result = await contextService.processQuery(contextQuery);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'ContextProcess');
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { db } = await getContextServices();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId parameter' }, { status: 400 });
    }

    // SECURITY: Verify conversation belongs to the authenticated user
    const owned = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!owned || owned.userId !== userId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Récupération des résultats de contexte pour une conversation
    const results = await db.query(
      `SELECT cq.*, cr.* 
       FROM context_queries cq
       LEFT JOIN context_results cr ON cq.id = cr.query_id
       WHERE cq.conversation_id = $1
       ORDER BY cq.created_at DESC
       LIMIT 10`,
      [conversationId]
    );

    return NextResponse.json({
      results: results.rows,
      total: results.rows.length,
    });
  } catch (error) {
    return handleApiError(error, 'ContextRetrieve');
  }
}
