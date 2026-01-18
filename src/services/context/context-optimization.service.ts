import { EmbeddingGenerationService } from '../embedding-generation.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

interface ContextItem {
  id: string;
  type: string;
  content: string;
  metadata: any;
  relevanceScore: number;
  tokens: number;
}

interface AssembledContext {
  content: string;
  items: ContextItem[];
  tokens: number;
  metadata: {
    itemCount: number;
    compressionRatio: number;
  };
}

interface OptimizationConstraints {
  maxTokens?: number;
  minQuality?: number;
}

interface QualityAssessment {
  score: number;
  details: {
    relevance: number;
    diversity: number;
    completeness: number;
  };
}

export class ContextOptimizationService {
  private embeddingService: EmbeddingGenerationService;
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
  }
  
  async optimize(
    context: AssembledContext,
    constraints: OptimizationConstraints
  ): Promise<AssembledContext> {
    let optimized = context;
    
    optimized = this.removeRedundancy(optimized);
    
    optimized = this.prioritizeRecent(optimized);
    
    optimized = this.balanceDiversity(optimized);
    
    if (constraints.maxTokens) {
      optimized = await this.fitTokenBudget(optimized, constraints.maxTokens);
    }
    
    const quality = await this.assessQuality(optimized);
    if (quality.score < (constraints.minQuality || 0.7)) {
      throw new Error('Context quality below threshold');
    }
    
    return optimized;
  }
  
  private removeRedundancy(context: AssembledContext): AssembledContext {
    const sentences = this.extractSentences(context.content);
    const uniqueSentences = Array.from(new Set(sentences));
    
    return {
      ...context,
      content: uniqueSentences.join(' '),
      tokens: this.estimateTokens(uniqueSentences.join(' '))
    };
  }
  
  private prioritizeRecent(context: AssembledContext): AssembledContext {
    const sortedItems = [...context.items].sort((a, b) => {
      const aTime = a.metadata.timestamp ? new Date(a.metadata.timestamp).getTime() : 0;
      const bTime = b.metadata.timestamp ? new Date(b.metadata.timestamp).getTime() : 0;
      return bTime - aTime;
    });
    
    return {
      ...context,
      items: sortedItems
    };
  }
  
  private balanceDiversity(context: AssembledContext): AssembledContext {
    const typeCount = new Map<string, number>();
    const balanced: ContextItem[] = [];
    
    for (const item of context.items) {
      const count = typeCount.get(item.type) || 0;
      if (count < 5) {
        balanced.push(item);
        typeCount.set(item.type, count + 1);
      }
    }
    
    return {
      ...context,
      items: balanced,
      metadata: {
        ...context.metadata,
        itemCount: balanced.length
      }
    };
  }
  
  private async fitTokenBudget(
    context: AssembledContext,
    maxTokens: number
  ): Promise<AssembledContext> {
    if (context.tokens <= maxTokens) {
      return context;
    }
    
    const selected: ContextItem[] = [];
    let totalTokens = 0;
    
    for (const item of context.items) {
      if (totalTokens + item.tokens <= maxTokens) {
        selected.push(item);
        totalTokens += item.tokens;
      }
    }
    
    const newContent = selected.map(i => i.content).join('\n\n');
    
    return {
      ...context,
      items: selected,
      content: newContent,
      tokens: totalTokens,
      metadata: {
        ...context.metadata,
        itemCount: selected.length
      }
    };
  }
  
  private async assessQuality(context: AssembledContext): Promise<QualityAssessment> {
    const relevance = this.assessRelevance(context);
    const diversity = this.assessDiversity(context);
    const completeness = this.assessCompleteness(context);
    
    const score = (relevance + diversity + completeness) / 3;
    
    return {
      score,
      details: {
        relevance,
        diversity,
        completeness
      }
    };
  }
  
  private assessRelevance(context: AssembledContext): number {
    const avgRelevance = context.items.reduce((sum, item) => sum + item.relevanceScore, 0) / context.items.length;
    return avgRelevance || 0.5;
  }
  
  private assessDiversity(context: AssembledContext): number {
    const types = new Set(context.items.map(i => i.type));
    return Math.min(1.0, types.size / 4);
  }
  
  private assessCompleteness(context: AssembledContext): number {
    return context.items.length >= 3 ? 1.0 : context.items.length / 3;
  }
  
  private extractSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
