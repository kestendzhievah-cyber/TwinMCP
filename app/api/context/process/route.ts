import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { ContextQuery, ContextResult } from '@/src/types/context-intelligent.types';
import { ContextIntelligentService } from '@/src/services/context-intelligent.service';
import { VectorSearchService } from '@/src/services/vector-search.service';
import { NLPService } from '@/src/services/nlp.service';
import { ContextTemplateEngine } from '@/src/services/context-template.service';

// Initialisation des services (adapter avec la vraie configuration)
import { pool as db } from '@/lib/prisma'

const vectorSearch = new VectorSearchService(db, null as any); // Adapter avec EmbeddingGenerationService
const nlp = new NLPService();
const templateEngine = new ContextTemplateEngine();

const contextService = new ContextIntelligentService(
  db,
  redis,
  vectorSearch,
  nlp,
  templateEngine
);

export async function POST(request: NextRequest) {
  try {
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
    console.error('Context processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process context',
        details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId parameter' },
        { status: 400 }
      );
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
      total: results.rows.length
    });
  } catch (error) {
    console.error('Context retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve context',
        details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
