import { logger } from '../utils/logger';
import { Pool } from 'pg';
import { VectorSearchQuery, VectorSearchResult, DocumentChunk } from '../types/embeddings.types';

export class VectorStorageService {
  constructor(private db: Pool) {}

  async storeEmbedding(embedding: {
    libraryId: string;
    chunkId: string;
    content: string;
    embedding: number[];
    model: string;
    metadata: any;
    sourceInfo?: any;
  }): Promise<string> {
    const contentHash = this.generateContentHash(embedding.content);
    
    // Vérification de déduplication
    const existing = await this.checkDuplicate(embedding.libraryId, contentHash);
    if (existing) {
      return existing.id;
    }

    const query = `
      INSERT INTO document_embeddings (
        library_id, chunk_id, content, content_hash, embedding,
        embedding_model, metadata, source_url, source_title,
        source_section, source_subsection, file_path,
        line_start, line_end, chunk_index, total_chunks,
        status, indexed_at
      ) VALUES (
        $1, $2, $3, $4, $5::vector,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, NOW()
      )
      RETURNING id
    `;

    const values = [
      embedding.libraryId,
      embedding.chunkId,
      embedding.content,
      contentHash,
      `[${embedding.embedding.join(',')}]`,
      embedding.model,
      JSON.stringify(embedding.metadata),
      embedding.sourceInfo?.url,
      embedding.sourceInfo?.title,
      embedding.sourceInfo?.section,
      embedding.sourceInfo?.subsection,
      embedding.sourceInfo?.filePath,
      embedding.sourceInfo?.lineStart,
      embedding.sourceInfo?.lineEnd,
      embedding.metadata.chunkIndex || 0,
      embedding.metadata.totalChunks || 1,
      'indexed'
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  async batchStoreEmbeddings(embeddings: Array<{
    libraryId: string;
    chunkId: string;
    content: string;
    embedding: number[];
    model: string;
    metadata: any;
    sourceInfo?: any;
  }>): Promise<{ stored: number; duplicates: number; errors: string[] }> {
    const client = await this.db.connect();
    let stored = 0;
    let duplicates = 0;
    const errors: string[] = [];

    try {
      await client.query('BEGIN');

      for (const embedding of embeddings) {
        try {
          const contentHash = this.generateContentHash(embedding.content);
          
          // Vérification rapide de déduplication
          const duplicateCheck = await client.query(
            'SELECT id FROM document_embeddings WHERE library_id = $1 AND content_hash = $2',
            [embedding.libraryId, contentHash]
          );

          if (duplicateCheck.rows.length > 0) {
            duplicates++;
            continue;
          }

          await client.query(`
            INSERT INTO document_embeddings (
              library_id, chunk_id, content, content_hash, embedding,
              embedding_model, metadata, source_url, source_title,
              source_section, source_subsection, file_path,
              line_start, line_end, chunk_index, total_chunks,
              status, indexed_at
            ) VALUES (
              $1, $2, $3, $4, $5::vector,
              $6, $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, NOW()
            )
          `, [
            embedding.libraryId,
            embedding.chunkId,
            embedding.content,
            contentHash,
            `[${embedding.embedding.join(',')}]`,
            embedding.model,
            JSON.stringify(embedding.metadata),
            embedding.sourceInfo?.url,
            embedding.sourceInfo?.title,
            embedding.sourceInfo?.section,
            embedding.sourceInfo?.subsection,
            embedding.sourceInfo?.filePath,
            embedding.sourceInfo?.lineStart,
            embedding.sourceInfo?.lineEnd,
            embedding.metadata.chunkIndex || 0,
            embedding.metadata.totalChunks || 1,
            'indexed'
          ]);

          stored++;
        } catch (error) {
          errors.push(`Error storing chunk ${embedding.chunkId}: ${(error as Error).message}`);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { stored, duplicates, errors };
  }

  async vectorSearch(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const startTime = Date.now();
    
    // Génération de l'embedding de requête (supposé déjà fait)
    const queryEmbedding = (query as any).queryEmbedding || [];
    
    // Construction de la requête SQL optimisée
    let sqlQuery = this.buildOptimizedVectorQuery(query);
    
    const params = [
      `[${queryEmbedding.join(',')}]`, // $1: query embedding
      query.threshold || 0.7,          // $2: threshold
      query.limit                      // $3: limit
    ];

    let paramIndex = 4;
    
    // Ajout des filtres dynamiques
    if (query.libraryId) {
      sqlQuery += ` AND de.library_id = $${paramIndex++}`;
      params.push(query.libraryId);
    }

    if (query.filters?.contentType) {
      sqlQuery += ` AND de.metadata->>'contentType' = ANY($${paramIndex++})`;
      params.push(query.filters.contentType as any);
    }

    if (query.filters?.codeLanguage) {
      sqlQuery += ` AND de.metadata->>'codeLanguage' = ANY($${paramIndex++})`;
      params.push(query.filters.codeLanguage as any);
    }

    if (query.filters?.section) {
      sqlQuery += ` AND de.source_section = ANY($${paramIndex++})`;
      params.push(query.filters.section as any);
    }

    sqlQuery += ` ORDER BY similarity DESC, de.last_accessed_at DESC`;

    const result = await this.db.query(sqlQuery, params);
    const searchTime = Date.now() - startTime;

    // Mise à jour des analytics
    await this.updateSearchAnalytics(query, result.rows, searchTime);

    return this.processVectorResults(result.rows, query);
  }

  private buildOptimizedVectorQuery(query: VectorSearchQuery): string {
    // Utilisation de l'index IVFFlat pour la performance
    let sql = `
      SELECT 
        de.id,
        de.library_id,
        de.chunk_id,
        de.content,
        de.metadata,
        de.source_url,
        de.source_title,
        de.source_section,
        de.source_subsection,
        de.file_path,
        de.line_start,
        de.line_end,
        de.chunk_index,
        de.total_chunks,
        de.embedding_model,
        de.created_at,
        de.updated_at,
        1 - (de.embedding <=> $1::vector) as similarity,
        ts_rank_cd(
          to_tsvector('english', de.content),
          plainto_tsquery('english', $4)
        ) as text_rank
      FROM document_embeddings de
      WHERE 1 - (de.embedding <=> $1::vector) >= $2
        AND de.status = 'indexed'
    `;

    // Ajout du texte de la requête pour le ranking hybride
    if (query.query) {
      sql = sql.replace('$4', `'${query.query}'`);
    } else {
      sql = sql.replace(', ts_rank_cd(...) as text_rank', '');
      sql = sql.replace('plainto_tsquery($4)', 'plainto_tsquery(\'\')');
    }

    return sql;
  }

  private async updateSearchAnalytics(
    query: VectorSearchQuery, 
    results: any[], 
    searchTime: number
  ): Promise<void> {
    // Création de la session de recherche
    const sessionResult = await this.db.query(`
      INSERT INTO search_sessions (
        user_id, query, query_embedding, filters, results_count, search_time_ms
      ) VALUES (
        $1, $2, $3::vector, $4, $5, $6
      ) RETURNING id
    `, [
      (query as any).userId,
      query.query,
      `[${(query as any).queryEmbedding?.join(',') || []}]`,
      JSON.stringify(query.filters || {}),
      results.length,
      searchTime
    ]);

    const sessionId = sessionResult.rows[0].id;

    // Enregistrement des résultats pour analytics
    if (results.length > 0) {
      const analyticsData = results.map((row, index) => `(
        '${sessionId}',
        '${row.library_id}',
        '${row.id}',
        ${index + 1},
        ${row.similarity},
        false,
        NULL
      )`).join(',');

      await this.db.query(`
        INSERT INTO search_analytics (
          session_id, library_id, chunk_id, rank, score, clicked, dwell_time_ms
        ) VALUES ${analyticsData}
      `);
    }
  }

  private processVectorResults(rows: any[], query: VectorSearchQuery): VectorSearchResult[] {
    return rows.map(row => {
      const chunk: DocumentChunk = {
        id: row.id,
        libraryId: row.library_id,
        content: row.content,
        metadata: {
          ...row.metadata,
          url: row.source_url,
          title: row.source_title,
          section: row.source_section,
          subsection: row.source_subsection,
          codeLanguage: row.metadata?.codeLanguage,
          contentType: row.metadata?.contentType || 'text',
          position: row.chunk_index,
          totalChunks: row.total_chunks,
          version: row.metadata?.version,
          lastModified: row.updated_at
        },
        embeddingModel: row.embedding_model,
        embeddingVersion: row.metadata?.embeddingVersion || 'v1',
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      // Score hybride combinant similarité vectorielle et ranking textuel
      const vectorScore = row.similarity;
      const textScore = row.text_rank || 0;
      const hybridScore = (vectorScore * 0.7) + (textScore * 0.3);

      return {
        chunk,
        score: hybridScore,
        relevance: this.calculateRelevance(hybridScore),
        highlights: this.generateHighlights(row.content, query.query || '')
      };
    });
  }

  async getEmbeddingStats(): Promise<{
    totalEmbeddings: number;
    embeddingsByModel: Record<string, number>;
    embeddingsByLibrary: Record<string, number>;
    averageChunkSize: number;
    storageSize: string;
    indexSize: string;
  }> {
    const queries = await Promise.all([
      this.db.query('SELECT COUNT(*) as total FROM document_embeddings'),
      this.db.query('SELECT embedding_model, COUNT(*) as count FROM document_embeddings GROUP BY embedding_model'),
      this.db.query('SELECT library_id, COUNT(*) as count FROM document_embeddings GROUP BY library_id'),
      this.db.query('SELECT AVG(LENGTH(content)) as avg_size FROM document_embeddings'),
      this.db.query(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('document_embeddings')) as total_size,
          pg_size_pretty(pg_relation_size('idx_document_embeddings_embedding_ivfflat')) as index_size
      `)
    ]);

    return {
      totalEmbeddings: parseInt(queries[0].rows[0].total),
      embeddingsByModel: queries[1].rows.reduce((acc, row) => {
        acc[row.embedding_model] = parseInt(row.count);
        return acc;
      }, {}),
      embeddingsByLibrary: queries[2].rows.reduce((acc, row) => {
        acc[row.library_id] = parseInt(row.count);
        return acc;
      }, {}),
      averageChunkSize: Math.round(parseFloat(queries[3].rows[0].avg_size)),
      storageSize: queries[4].rows[0].total_size,
      indexSize: queries[4].rows[0].index_size
    };
  }

  async optimizeIndexes(): Promise<void> {
    // Réorganisation des index pour meilleure performance
    await this.db.query('VACUUM ANALYZE document_embeddings');
    
    // Mise à jour des statistiques pour l'optimiseur de requêtes
    await this.db.query('ANALYZE document_embeddings');
    
    // Reconstruction de l'index vectoriel si nécessaire
    const indexStats = await this.db.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE tablename = 'document_embeddings'
    `);

    logger.info('Index stats:', indexStats.rows);
  }

  async cleanupOldEmbeddings(daysToKeep: number = 90): Promise<{
    deletedCount: number;
    freedSpace: string;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db.query(`
      WITH deleted AS (
        DELETE FROM document_embeddings 
        WHERE created_at < $1 AND last_accessed_at < $1
        RETURNING id
      )
      SELECT COUNT(*) as count, pg_size_pretty(pg_relation_size('document_embeddings')) as size
      FROM deleted
    `, [cutoffDate]);

    return {
      deletedCount: parseInt(result.rows[0].count),
      freedSpace: result.rows[0].size
    };
  }

  private generateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async checkDuplicate(libraryId: string, contentHash: string): Promise<{ id: string } | null> {
    const result = await this.db.query(
      'SELECT id FROM document_embeddings WHERE library_id = $1 AND content_hash = $2',
      [libraryId, contentHash]
    );

    return result.rows[0] || null;
  }

  private calculateRelevance(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.85) return 'high';
    if (score >= 0.75) return 'medium';
    return 'low';
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      if (queryWords.some(word => lowerSentence.includes(word))) {
        const highlight = sentence.trim().substring(0, 200) + (sentence.length > 200 ? '...' : '');
        highlights.push(highlight);
      }
    }
    
    return highlights.slice(0, 3);
  }
}
