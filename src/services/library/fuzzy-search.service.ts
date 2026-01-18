import Fuse from 'fuse.js';
import leven from 'leven';
import { compareTwoStrings } from 'string-similarity';
import { EmbeddingGenerationService } from '../embedding-generation.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

interface Library {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  tags: string[];
}

interface SearchOptions {
  limit?: number;
  threshold?: number;
}

interface Scores {
  fuse: number;
  levenshtein: number;
  jaro: number;
  semantic: number;
}

interface SearchResult {
  library: Library;
  scores: Scores;
  finalScore: number;
}

export class FuzzySearchService {
  private fuse: Fuse<Library>;
  private embeddingService: EmbeddingGenerationService;
  private db: Pool;
  private redis: Redis;
  
  constructor(libraries: Library[], db: Pool, redis: Redis) {
    this.fuse = new Fuse(libraries, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'description', weight: 0.3 },
        { name: 'keywords', weight: 0.2 },
        { name: 'tags', weight: 0.1 }
      ],
      threshold: 0.4,
      includeScore: true,
      useExtendedSearch: true
    });
    this.db = db;
    this.redis = redis;
    this.embeddingService = new EmbeddingGenerationService(db, redis, {
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      defaultModel: 'text-embedding-3-small',
      maxRetries: 3,
      retryDelay: 1000
    });
  }
  
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const fuseResults = this.fuse.search(query, {
      limit: options.limit || 20
    });
    
    const enrichedResults = fuseResults.map(result => {
      const library = result.item;
      
      return {
        library,
        scores: {
          fuse: 1 - (result.score || 0),
          levenshtein: this.levenshteinSimilarity(query, library.name),
          jaro: compareTwoStrings(query.toLowerCase(), library.name.toLowerCase()),
          semantic: 0
        },
        finalScore: 0
      };
    });
    
    return enrichedResults.map(r => ({
      ...r,
      finalScore: this.calculateFinalScore(r.scores)
    })).sort((a, b) => b.finalScore - a.finalScore);
  }
  
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = leven(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }
  
  private calculateFinalScore(scores: Scores): number {
    return (
      scores.fuse * 0.3 +
      scores.levenshtein * 0.2 +
      scores.jaro * 0.2 +
      scores.semantic * 0.3
    );
  }
  
  async searchWithSemantics(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const fuzzyResults = this.search(query, { limit: 50 });
    
    const embeddingResults = await this.embeddingService.generateEmbeddings({
      chunks: [{ id: 'query', content: query, metadata: {} }],
      model: 'text-embedding-3-small'
    });
    const queryEmbedding = embeddingResults[0]?.embedding || [];
    
    for (const result of fuzzyResults) {
      const libraryEmbedding = await this.getLibraryEmbedding(result.library.id);
      result.scores.semantic = this.cosineSimilarity(queryEmbedding, libraryEmbedding);
      result.finalScore = this.calculateFinalScore(result.scores);
    }
    
    return fuzzyResults
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, options.limit || 10);
  }
  
  private async getLibraryEmbedding(libraryId: string): Promise<number[]> {
    return [];
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
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
