import { PrismaClient } from '@prisma/client';
import { EmbeddingGenerationService } from '../embedding-generation.service';
import { LLMService } from '../llm.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface ContextOptions {
  conversationId?: string;
  maxTokens?: number;
}

interface QueryIntent {
  primaryIntent: string;
  requiredContextTypes: string[];
  libraries: string[];
  complexityLevel: string;
}

interface ContextItem {
  id: string;
  type: string;
  content: string;
  metadata: any;
  relevanceScore: number;
  tokens: number;
  finalScore?: number;
}

export class ContextSelectionService {
  private embeddingService: EmbeddingGenerationService;
  private llmService: LLMService;
  private db: Pool;
  private redis: Redis;
  
  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.embeddingService = new EmbeddingGenerationService(db, redis, {
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      defaultModel: 'text-embedding-3-small',
      maxRetries: 3,
      retryDelay: 1000
    });
    this.llmService = new LLMService(db, redis);
  }
  
  async selectContext(
    query: string,
    options: ContextOptions = {}
  ): Promise<ContextItem[]> {
    const intent = await this.analyzeIntent(query);
    
    const docs = await this.searchRelevantDocs(query, intent);
    
    const history = await this.getRelevantHistory(
      options.conversationId,
      query
    );
    
    const examples = await this.getRelevantExamples(query, intent);
    
    const allContext = [...docs, ...history, ...examples];
    const ranked = await this.rankContext(allContext, query, intent);
    
    return this.optimizeForTokenBudget(ranked, options.maxTokens || 4000);
  }
  
  private async analyzeIntent(query: string): Promise<QueryIntent> {
    const response = await this.llmService.generateResponse({
      id: crypto.randomUUID(),
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Analyze the user's query and determine:
1. Primary intent (explanation, example, troubleshooting, comparison, etc.)
2. Required context types (documentation, code, API reference, etc.)
3. Specific libraries or technologies mentioned
4. Complexity level (beginner, intermediate, advanced)

Respond in JSON format.`
      }, {
        role: 'user',
        content: query
      }],
      options: { temperature: 0.3 },
      metadata: {}
    });
    
    return JSON.parse(response.content || '{}');
  }
  
  private async searchRelevantDocs(
    query: string,
    intent: QueryIntent
  ): Promise<ContextItem[]> {
    const results = await prisma.crawledContent.findMany({
      where: {
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 20
    });
    
    return results.map(r => ({
      id: r.id,
      type: 'documentation',
      content: r.content || '',
      metadata: { title: r.title, url: r.url },
      relevanceScore: 0.8,
      tokens: this.estimateTokens(r.content || '')
    }));
  }
  
  private async getRelevantHistory(
    conversationId: string | undefined,
    query: string
  ): Promise<ContextItem[]> {
    if (!conversationId) return [];
    
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    const embeddingResults = await this.embeddingService.generateEmbeddings({
      chunks: [{ id: 'query', content: query, metadata: {} }],
      model: 'text-embedding-3-small'
    });
    const queryEmbedding = embeddingResults[0]?.embedding || [];
    const relevantMessages: ContextItem[] = [];
    
    for (const msg of messages) {
      const msgEmbedding = await this.getMessageEmbedding(msg.id);
      const similarity = this.cosineSimilarity(queryEmbedding, msgEmbedding);
      
      if (similarity > 0.6) {
        relevantMessages.push({
          id: msg.id,
          type: 'history',
          content: msg.content,
          metadata: { role: msg.role, timestamp: msg.createdAt },
          relevanceScore: similarity,
          tokens: this.estimateTokens(msg.content)
        });
      }
    }
    
    return relevantMessages;
  }
  
  private async getRelevantExamples(query: string, intent: QueryIntent): Promise<ContextItem[]> {
    return [];
  }
  
  private async rankContext(
    items: ContextItem[],
    query: string,
    intent: QueryIntent
  ): Promise<ContextItem[]> {
    for (const item of items) {
      const recencyScore = this.getRecencyScore(item.metadata.timestamp);
      const typeScore = this.getTypeScore(item.type, intent);
      const diversityScore = await this.getDiversityScore(item, items);
      
      item.finalScore = (
        item.relevanceScore * 0.5 +
        recencyScore * 0.2 +
        typeScore * 0.2 +
        diversityScore * 0.1
      );
    }
    
    return items.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
  }
  
  private optimizeForTokenBudget(
    items: ContextItem[],
    maxTokens: number
  ): ContextItem[] {
    const selected: ContextItem[] = [];
    let totalTokens = 0;
    
    for (const item of items) {
      if (totalTokens + item.tokens <= maxTokens) {
        selected.push(item);
        totalTokens += item.tokens;
      } else {
        const availableTokens = maxTokens - totalTokens;
        if (availableTokens > 100) {
          const truncated = this.truncateContent(item, availableTokens);
          selected.push(truncated);
          break;
        }
      }
    }
    
    return selected;
  }
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  private getRecencyScore(timestamp?: Date): number {
    if (!timestamp) return 0.5;
    const now = new Date();
    const daysSince = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSince < 1) return 1.0;
    if (daysSince < 7) return 0.8;
    if (daysSince < 30) return 0.6;
    return 0.4;
  }
  
  private getTypeScore(type: string, intent: QueryIntent): number {
    const typeScores: Record<string, number> = {
      documentation: 0.9,
      code: 0.8,
      history: 0.7,
      example: 0.85
    };
    return typeScores[type] || 0.5;
  }
  
  private async getDiversityScore(item: ContextItem, allItems: ContextItem[]): Promise<number> {
    return 0.7;
  }
  
  private truncateContent(item: ContextItem, maxTokens: number): ContextItem {
    const maxChars = maxTokens * 4;
    return {
      ...item,
      content: item.content.substring(0, maxChars),
      tokens: maxTokens
    };
  }
  
  private async getMessageEmbedding(messageId: string): Promise<number[]> {
    return [];
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
