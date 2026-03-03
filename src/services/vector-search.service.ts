import { Pool } from 'pg';
import { EmbeddingGenerationService } from './embedding-generation.service';
import { VectorSearchQuery, VectorSearchResult, DocumentChunk } from '../types/embeddings.types';
import {
  DEFAULT_EMBEDDING_MODEL,
  VECTOR_SEARCH_CONFIG,
  RELEVANCE_THRESHOLDS
} from '../config/embeddings.config';

export class VectorSearchService {
  constructor(
    private db: Pool,
    private embeddingService: EmbeddingGenerationService
  ) {}

  async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const queryEmbedding = await this.generateQueryEmbedding(query.query);
    
    const sqlQuery = this.buildVectorSearchSQL(query);
    
    const params: any[] = [
      queryEmbedding,
      query.limit,
      query.threshold || VECTOR_SEARCH_CONFIG.defaultThreshold
    ];

    if (query.libraryId) {
      params.push(query.libraryId);
    }

    if (query.filters?.contentType) {
      params.push(query.filters.contentType);
    }

    if (query.filters?.codeLanguage) {
      params.push(query.filters.codeLanguage);
    }

    if (query.filters?.version) {
      params.push(query.filters.version);
    }

    if (query.filters?.section) {
      params.push(query.filters.section);
    }
    
    const results = await this.db.query(sqlQuery, params);
    
    return this.processSearchResults(results.rows, query);
  }

  private async generateQueryEmbedding(queryText: string): Promise<number[]> {
    const result = await this.embeddingService.generateEmbeddings({
      chunks: [{
        id: 'query',
        content: queryText,
        metadata: {
          url: '',
          title: 'Query',
          contentType: 'text',
          position: 0,
          totalChunks: 1,
          lastModified: new Date()
        }
      }],
      model: DEFAULT_EMBEDDING_MODEL
    });
    
    if (result.length === 0 || !result[0]) {
      throw new Error('Failed to generate embedding for query');
    }
    
    return result[0]!.embedding;
  }

  private buildVectorSearchSQL(query: VectorSearchQuery): string {
    let sql = `
      SELECT 
        dc.*,
        1 - (dc.embedding <=> $1::vector) as similarity,
        dm.title,
        dm.url,
        dm.section,
        dm.subsection,
        dm.content_type,
        dm.code_language,
        dm.version,
        dm.file_path,
        dm.last_modified
      FROM document_chunks dc
      JOIN document_metadata dm ON dc.library_id = dm.library_id
      WHERE 1 - (dc.embedding <=> $1::vector) >= $3
    `;
    
    let paramIndex = 4;
    
    if (query.libraryId) {
      sql += ` AND dc.library_id = $${paramIndex}`;
      paramIndex++;
    }
    
    if (query.filters?.contentType) {
      sql += ` AND dm.content_type = ANY($${paramIndex})`;
      paramIndex++;
    }
    
    if (query.filters?.codeLanguage) {
      sql += ` AND dm.code_language = ANY($${paramIndex})`;
      paramIndex++;
    }
    
    if (query.filters?.version) {
      sql += ` AND dm.version = $${paramIndex}`;
      paramIndex++;
    }
    
    if (query.filters?.section) {
      sql += ` AND dm.section = ANY($${paramIndex})`;
      paramIndex++;
    }
    
    sql += `
      ORDER BY similarity DESC
      LIMIT $2
    `;
    
    return sql;
  }

  private processSearchResults(rows: any[], query: VectorSearchQuery): VectorSearchResult[] {
    return rows.map(row => {
      const chunk: DocumentChunk = {
        id: row.id,
        libraryId: row.library_id,
        content: row.content,
        metadata: {
          url: row.url,
          title: row.title,
          section: row.section,
          subsection: row.subsection,
          contentType: row.content_type,
          codeLanguage: row.code_language,
          version: row.version,
          position: row.position,
          totalChunks: row.total_chunks,
          lastModified: row.last_modified
        },
        embedding: row.embedding,
        embeddingModel: row.embedding_model,
        embeddingVersion: row.embedding_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
      const relevance = this.calculateRelevance(row.similarity);
      const highlights = query.includeMetadata ? this.generateHighlights(chunk.content, query.query) : [];
      
      const searchResult: VectorSearchResult = {
        chunk,
        score: row.similarity,
        relevance
      };
      
      if (highlights.length > 0) {
        searchResult.highlights = highlights;
      }
      
      return searchResult;
    });
  }

  private calculateRelevance(similarity: number): 'high' | 'medium' | 'low' {
    if (similarity >= RELEVANCE_THRESHOLDS.high) return 'high';
    if (similarity >= RELEVANCE_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      if (queryWords.some(word => lowerSentence.includes(word))) {
        const highlight = sentence.trim().substring(0, VECTOR_SEARCH_CONFIG.highlightLength) + 
                         (sentence.length > VECTOR_SEARCH_CONFIG.highlightLength ? '...' : '');
        highlights.push(highlight);
      }
    }
    
    return highlights.slice(0, VECTOR_SEARCH_CONFIG.maxHighlights);
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const result = await this.db.query(`
        SELECT COUNT(*) as count 
        FROM document_chunks 
        WHERE embedding IS NOT NULL
      `);
      
      return {
        status: 'healthy',
        details: {
          indexedChunks: parseInt(result.rows[0].count),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async getSimilarChunks(chunkId: string, limit: number = 10): Promise<VectorSearchResult[]> {
    const result = await this.db.query(`
      SELECT content, embedding 
      FROM document_chunks 
      WHERE id = $1
    `, [chunkId]);

    if (result.rows.length === 0) {
      throw new Error(`Chunk with id ${chunkId} not found`);
    }

    const chunk = result.rows[0];
    const query: VectorSearchQuery = {
      query: chunk.content,
      limit,
      threshold: 0.5,
      includeMetadata: true
    };

    return this.search(query);
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    await this.db.query(`
      UPDATE document_chunks 
      SET embedding = $1, updated_at = NOW() 
      WHERE id = $2
    `, [embedding, chunkId]);
  }

  async deleteChunkEmbedding(chunkId: string): Promise<void> {
    await this.db.query(`
      UPDATE document_chunks 
      SET embedding = NULL, updated_at = NOW() 
      WHERE id = $1
    `, [chunkId]);
  }

  async getLibraryStats(libraryId: string): Promise<{
    totalChunks: number;
    indexedChunks: number;
    lastIndexed: Date | null;
  }> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(embedding) as indexed_chunks,
        MAX(updated_at) as last_indexed
      FROM document_chunks 
      WHERE library_id = $1
    `, [libraryId]);

    const row = result.rows[0];
    return {
      totalChunks: parseInt(row.total_chunks),
      indexedChunks: parseInt(row.indexed_chunks),
      lastIndexed: row.last_indexed ? new Date(row.last_indexed) : null
    };
  }
}
