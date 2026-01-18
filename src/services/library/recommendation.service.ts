import { PrismaClient } from '@prisma/client';
import { EmbeddingGenerationService } from '../embedding-generation.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

const prisma = new PrismaClient();

interface Library {
  id: string;
  name: string;
  tags: string[];
  category?: string;
  language?: string;
  qualityScore?: number;
  downloads?: number;
  lastUpdated: Date;
}

interface RecommendationContext {
  userId?: string;
  projectId?: string;
  preferences?: any;
}

interface Recommendation {
  library: Library;
  type: 'similar' | 'alternative' | 'complementary';
  score: number;
  reason?: string;
}

export class RecommendationService {
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
  
  async getRecommendations(
    libraryId: string,
    context: RecommendationContext
  ): Promise<Recommendation[]> {
    const library = await this.getLibrary(libraryId);
    
    const similar = await this.findSimilarLibraries(library);
    
    const alternatives = await this.findAlternatives(library);
    
    const complementary = await this.findComplementary(library, context);
    
    return this.rankRecommendations([
      ...similar.map(l => ({ library: l, type: 'similar' as const, score: 0 })),
      ...alternatives.map(l => ({ library: l, type: 'alternative' as const, score: 0 })),
      ...complementary.map(l => ({ library: l, type: 'complementary' as const, score: 0 }))
    ]);
  }
  
  private async getLibrary(libraryId: string): Promise<Library> {
    const library = await prisma.library.findUnique({
      where: { id: libraryId }
    });
    
    if (!library) {
      throw new Error(`Library ${libraryId} not found`);
    }
    
    return library as any;
  }
  
  private async findSimilarLibraries(library: Library): Promise<Library[]> {
    const libraryEmbedding = await this.getLibraryEmbedding(library.id);
    
    const results = await prisma.$queryRaw<Library[]>`
      SELECT l.*, 
        1 - (e.vector <=> ${libraryEmbedding}::vector) as similarity
      FROM libraries l
      JOIN library_embeddings e ON e.library_id = l.id
      WHERE l.id != ${library.id}
        AND 1 - (e.vector <=> ${libraryEmbedding}::vector) > 0.7
      ORDER BY e.vector <=> ${libraryEmbedding}::vector
      LIMIT 10
    `;
    
    return results;
  }
  
  private async findAlternatives(library: Library): Promise<Library[]> {
    return await prisma.library.findMany({
      where: {
        id: { not: library.id },
        OR: [
          { tags: { hasSome: library.tags } },
          { category: library.category }
        ],
        language: library.language
      },
      orderBy: { qualityScore: 'desc' },
      take: 10
    }) as any[];
  }
  
  private async findComplementary(
    library: Library,
    context: RecommendationContext
  ): Promise<Library[]> {
    const coOccurrences = await prisma.$queryRaw<Library[]>`
      SELECT l.*, COUNT(*) as co_occurrence_count
      FROM libraries l
      JOIN project_dependencies pd1 ON pd1.library_id = l.id
      JOIN project_dependencies pd2 ON pd2.project_id = pd1.project_id
      WHERE pd2.library_id = ${library.id}
        AND l.id != ${library.id}
      GROUP BY l.id
      ORDER BY co_occurrence_count DESC
      LIMIT 10
    `;
    
    return coOccurrences;
  }
  
  private async rankRecommendations(
    recommendations: Recommendation[]
  ): Promise<Recommendation[]> {
    for (const rec of recommendations) {
      const qualityScore = rec.library.qualityScore || 0;
      const popularityScore = Math.log10((rec.library.downloads || 0) + 1) / 10;
      const recencyScore = this.getRecencyScore(rec.library.lastUpdated);
      
      const typeWeight = {
        similar: 0.4,
        alternative: 0.3,
        complementary: 0.3
      };
      
      rec.score = (
        qualityScore * 0.4 +
        popularityScore * 0.3 +
        recencyScore * 0.3
      ) * typeWeight[rec.type];
    }
    
    return recommendations.sort((a, b) => b.score - a.score);
  }
  
  private getRecencyScore(lastUpdated: Date): number {
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < 30) return 1.0;
    if (daysSinceUpdate < 90) return 0.8;
    if (daysSinceUpdate < 180) return 0.6;
    if (daysSinceUpdate < 365) return 0.4;
    return 0.2;
  }
  
  private async getLibraryEmbedding(libraryId: string): Promise<number[]> {
    return [];
  }
}
