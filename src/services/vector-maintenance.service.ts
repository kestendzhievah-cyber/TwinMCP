import { Pool } from 'pg';
import { VectorStorageService } from './vector-storage.service';

export class VectorMaintenanceService {
  constructor(
    private db: Pool,
    private vectorStorage: VectorStorageService
  ) {}

  async performMaintenance(): Promise<{
    optimized: boolean;
    cleaned: boolean;
    reindexed: boolean;
    stats: any;
  }> {
    const results = {
      optimized: false,
      cleaned: false,
      reindexed: false,
      stats: null as any
    };

    try {
      // 1. Optimisation des index
      await this.vectorStorage.optimizeIndexes();
      results.optimized = true;

      // 2. Nettoyage des anciens embeddings
      const cleanupResult = await this.vectorStorage.cleanupOldEmbeddings(90);
      results.cleaned = cleanupResult.deletedCount > 0;

      // 3. Mise à jour des statistiques
      results.stats = await this.vectorStorage.getEmbeddingStats();

      // 4. Vérification de la nécessité de réindexer
      const shouldReindex = await this.shouldReindex();
      if (shouldReindex) {
        await this.reindexIfNeeded();
        results.reindexed = true;
      }

    } catch (error) {
      console.error('Maintenance error:', error);
    }

    return results;
  }

  private async shouldReindex(): Promise<boolean> {
    // Vérifier si l'index est fragmenté
    const result = await this.db.query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('document_embeddings')) as total_size,
        pg_size_pretty(pg_relation_size('idx_document_embeddings_embedding_ivfflat')) as index_size,
        (SELECT COUNT(*) FROM document_embeddings) as total_rows
    `);

    const stats = result.rows[0];
    const totalSize = this.parseSize(stats.total_size);
    const indexSize = this.parseSize(stats.index_size);
    const totalRows = parseInt(stats.total_rows);

    // Réindexer si l'index représente plus de 50% de la taille totale
    // ou si nous avons plus de 1M de rows
    return (indexSize / totalSize > 0.5) || totalRows > 1000000;
  }

  private async reindexIfNeeded(): Promise<void> {
    // Création d'un nouvel index avec des paramètres optimisés
    await this.db.query(`
      CREATE INDEX CONCURRENTLY idx_document_embeddings_embedding_ivfflat_new
      ON document_embeddings 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = LEAST(1000, CEIL(SQRT(SELECT COUNT(*) FROM document_embeddings))))
    `);

    // Remplacement de l'ancien index
    await this.db.query(`
      DROP INDEX CONCURRENTLY idx_document_embeddings_embedding_ivfflat;
      ALTER INDEX idx_document_embeddings_embedding_ivfflat_new 
      RENAME TO idx_document_embeddings_embedding_ivfflat;
    `);
  }

  private parseSize(sizeStr: string | undefined): number {
    if (!sizeStr) return 0;
    
    const units = { 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024 };
    const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/);
    
    if (!match) return 0;
    
    const [, value, unit] = match;
    if (!unit) return 0;
    return parseFloat(value) * units[unit as keyof typeof units];
  }

  async getMaintenanceReport(): Promise<{
    databaseSize: string;
    indexSize: string;
    totalEmbeddings: number;
    indexEfficiency: number;
    lastMaintenance: Date;
    recommendations: string[];
  }> {
    const [sizeResult, statsResult] = await Promise.all([
      this.db.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          pg_size_pretty(pg_total_relation_size('document_embeddings')) as table_size,
          pg_size_pretty(pg_relation_size('idx_document_embeddings_embedding_ivfflat')) as index_size
      `),
      this.vectorStorage.getEmbeddingStats()
    ]);

    const dbSize = sizeResult.rows[0].db_size;
    const tableSize = sizeResult.rows[0].table_size;
    const indexSize = sizeResult.rows[0].index_size;
    
    const tableSizeBytes = this.parseSize(tableSize);
    const indexSizeBytes = this.parseSize(indexSize);
    const indexEfficiency = tableSizeBytes > 0 ? indexSizeBytes / tableSizeBytes : 0;

    const recommendations: string[] = [];
    
    if (indexEfficiency > 0.5) {
      recommendations.push('Considérer la reconstruction de l\'index vectoriel');
    }
    
    if (statsResult.totalEmbeddings > 1000000) {
      recommendations.push('Considérer l\'utilisation de HNSW pour de meilleures performances');
    }
    
    if (statsResult.averageChunkSize > 2000) {
      recommendations.push('Les chunks sont peut-être trop grands, considérer un découpage plus fin');
    }

    return {
      databaseSize: dbSize,
      indexSize,
      totalEmbeddings: statsResult.totalEmbeddings,
      indexEfficiency: Math.round(indexEfficiency * 100) / 100,
      lastMaintenance: new Date(), // À récupérer depuis une table de logs
      recommendations
    };
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db.query(`
      DELETE FROM search_sessions 
      WHERE expires_at < NOW()
      RETURNING id
    `);
    
    return result.rows.length;
  }

  async updateIndexParameters(lists?: number): Promise<void> {
    const optimalLists = lists || await this.calculateOptimalLists();
    
    await this.db.query(`
      CREATE INDEX CONCURRENTLY idx_document_embeddings_embedding_ivfflat_temp
      ON document_embeddings 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = $1)
    `, [optimalLists]);

    await this.db.query(`
      DROP INDEX CONCURRENTLY idx_document_embeddings_embedding_ivfflat;
      ALTER INDEX idx_document_embeddings_embedding_ivfflat_temp 
      RENAME TO idx_document_embeddings_embedding_ivfflat;
    `);
  }

  private async calculateOptimalLists(): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM document_embeddings
    `);
    
    const count = parseInt(result.rows[0].count);
    return Math.min(1000, Math.ceil(Math.sqrt(count)));
  }

  async analyzeIndexPerformance(): Promise<{
    indexType: string;
    indexSize: string;
    indexEfficiency: number;
    avgSearchTime: number;
    recommendations: string[];
  }> {
    const [indexInfo, performanceInfo] = await Promise.all([
      this.db.query(`
        SELECT 
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as size,
          schemaname,
          tablename
        FROM pg_stat_user_indexes
        WHERE tablename = 'document_embeddings' AND indexname LIKE '%embedding%'
      `),
      this.db.query(`
        SELECT 
          AVG(search_time_ms) as avg_search_time
        FROM search_sessions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `)
    ]);

    const indexType = indexInfo.rows[0]?.indexname?.includes('hnsw') ? 'HNSW' : 'IVFFlat';
    const indexSize = indexInfo.rows[0]?.size || 'Unknown';
    const avgSearchTime = parseFloat(performanceInfo.rows[0]?.avg_search_time || '0');

    const recommendations: string[] = [];
    
    if (avgSearchTime > 200) {
      recommendations.push('Temps de recherche élevé, considérer HNSW pour de meilleures performances');
    }
    
    if (indexType === 'IVFFlat' && avgSearchTime > 100) {
      recommendations.push('Considérer l\'augmentation du paramètre lists pour IVFFlat');
    }

    return {
      indexType,
      indexSize,
      indexEfficiency: 0.3, // À calculer réellement
      avgSearchTime,
      recommendations
    };
  }

  async scheduleMaintenance(frequency: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<void> {
    // Cette méthode pourrait configurer des jobs cron ou utiliser pg_cron
    const schedules = {
      daily: '0 2 * * *',      // 2 AM tous les jours
      weekly: '0 2 * * 0',     // 2 AM tous les dimanches
      monthly: '0 2 1 * *'     // 2 AM le 1er du mois
    };

    const schedule = schedules[frequency];
    
    // Exemple avec pg_cron (extension requise)
    // await this.db.query(`
    //   SELECT cron.schedule('vector-maintenance', $1, 'SELECT perform_vector_maintenance()')
    // `, [schedule]);
    
    console.log(`Maintenance scheduled with frequency: ${frequency} (${schedule})`);
  }
}
