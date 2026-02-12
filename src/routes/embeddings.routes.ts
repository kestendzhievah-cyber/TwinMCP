import { Router, Request, Response } from 'express';
import { EmbeddingGenerationService } from '../services/embedding-generation.service';
import { VectorSearchService } from '../services/vector-search.service';
import { EmbeddingAnalyticsService } from '../services/embedding-analytics.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { z } from 'zod';
import {
  EmbeddingGenerationConfig
} from '../types/embeddings.types';

const router = Router();

// Schémas de validation avec Zod
const generateEmbeddingsSchema = z.object({
  chunks: z.array(z.object({
    id: z.string(),
    content: z.string(),
    metadata: z.object({
      url: z.string(),
      title: z.string(),
      section: z.string().optional(),
      subsection: z.string().optional(),
      codeLanguage: z.string().optional(),
      contentType: z.enum(['text', 'code', 'example', 'api']),
      position: z.number(),
      totalChunks: z.number(),
      version: z.string().optional(),
      lastModified: z.date()
    })
  })),
  model: z.string().optional(),
  batchSize: z.number().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional()
});

const vectorSearchSchema = z.object({
  query: z.string(),
  libraryId: z.string().optional(),
  filters: z.object({
    contentType: z.array(z.enum(['text', 'code', 'example', 'api'])).optional(),
    codeLanguage: z.array(z.string()).optional(),
    version: z.string().optional(),
    section: z.array(z.string()).optional()
  }).optional(),
  limit: z.number(),
  threshold: z.number().optional(),
  includeMetadata: z.boolean().optional()
});

// Middleware d'initialisation des services
const initializeServices = (req: Request, res: Response, next: any) => {
  try {
    const db = req.app.get('db') as Pool;
    const redis = req.app.get('redis') as Redis;
    const config = req.app.get('embeddingConfig') as EmbeddingGenerationConfig;

    if (!db || !redis || !config) {
      res.status(500).json({
        error: 'Services not properly initialized',
        details: 'Missing database, redis, or configuration'
      });
      return;
    }

    req.embeddingService = new EmbeddingGenerationService(db, redis, config);
    req.vectorSearchService = new VectorSearchService(db, req.embeddingService);
    req.analyticsService = new EmbeddingAnalyticsService(redis, db);

    next();
  } catch (error) {
    console.error('Error initializing services:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
};

// Extension du type Request pour inclure les services
declare global {
  namespace Express {
    interface Request {
      embeddingService?: EmbeddingGenerationService;
      vectorSearchService?: VectorSearchService;
      analyticsService?: EmbeddingAnalyticsService;
    }
  }
}

/**
 * @route POST /api/embeddings/generate
 * @desc Générer des embeddings pour les chunks fournis
 * @access Public
 */
router.post('/generate', initializeServices, async (req: Request, res: Response) => {
  try {
    const validatedData = generateEmbeddingsSchema.parse(req.body);
    const embeddingRequest: any = {
      chunks: validatedData.chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          section: chunk.metadata.section || undefined,
          subsection: chunk.metadata.subsection || undefined,
          codeLanguage: chunk.metadata.codeLanguage || undefined,
          version: chunk.metadata.version || undefined
        }
      })),
      model: validatedData.model,
      batchSize: validatedData.batchSize,
      priority: validatedData.priority
    };
    const result = await req.embeddingService!.generateEmbeddings(embeddingRequest);
    
    res.json({
      success: true,
      data: result,
      metadata: {
        chunksProcessed: result.length,
        totalTokens: result.reduce((sum: number, r: any) => sum + r.tokens, 0),
        totalCost: result.reduce((sum: number, r: any) => sum + r.cost, 0),
        averageProcessingTime: result.reduce((sum: number, r: any) => sum + r.processingTime, 0) / result.length
      }
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
      return;
    }
    
    res.status(500).json({
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/embeddings/search
 * @desc Rechercher des documents similaires using vector search
 * @access Public
 */
router.post('/search', initializeServices, async (req: Request, res: Response) => {
  try {
    const validatedData = vectorSearchSchema.parse(req.body);
    const searchQuery: any = {
      query: validatedData.query,
      libraryId: validatedData.libraryId || undefined,
      filters: validatedData.filters || undefined,
      limit: validatedData.limit,
      threshold: validatedData.threshold || undefined,
      includeMetadata: validatedData.includeMetadata || undefined
    };
    const results = await req.vectorSearchService!.search(searchQuery);
    
    res.json({
      success: true,
      data: results,
      metadata: {
        query: validatedData.query,
        resultsCount: results.length,
        threshold: validatedData.threshold || 0.7,
        filters: validatedData.filters
      }
    });
  } catch (error) {
    console.error('Error performing vector search:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
      return;
    }
    
    res.status(500).json({
      error: 'Failed to perform search',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/embeddings/stats
 * @desc Obtenir les statistiques d'embeddings
 * @access Public
 */
router.get('/stats', initializeServices, async (req: Request, res: Response) => {
  try {
    const timeRange = (req.query['timeRange'] as 'hour' | 'day' | 'week') || 'day';
    const stats = await req.analyticsService!.getEmbeddingStats(timeRange);
    
    res.json({
      success: true,
      data: stats,
      metadata: {
        timeRange,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/embeddings/forecast
 * @desc Obtenir une prévision des coûts
 * @access Public
 */
router.get('/forecast', initializeServices, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const forecast = await req.analyticsService!.getCostForecast(days);
    
    res.json({
      success: true,
      data: forecast,
      metadata: {
        forecastDays: days,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({
      error: 'Failed to generate forecast',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/embeddings/alerts
 * @desc Obtenir les alertes de coûts et performance
 * @access Public
 */
router.get('/alerts', initializeServices, async (req: Request, res: Response) => {
  try {
    const alerts = await req.analyticsService!.getCostAlerts();
    
    res.json({
      success: true,
      data: alerts,
      metadata: {
        count: alerts.length,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/embeddings/library/:libraryId/stats
 * @desc Obtenir les statistiques pour une bibliothèque spécifique
 * @access Public
 */
router.get('/library/:libraryId/stats', initializeServices, async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    if (!libraryId) {
      res.status(400).json({
        error: 'Library ID is required',
        details: 'Missing libraryId parameter'
      });
      return;
    }
    const stats = await req.analyticsService!.getLibraryAnalytics(libraryId);
    
    res.json({
      success: true,
      data: stats,
      metadata: {
        libraryId,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching library stats:', error);
    res.status(500).json({
      error: 'Failed to fetch library statistics',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/embeddings/health
 * @desc Vérifier l'état de santé des services d'embeddings
 * @access Public
 */
router.get('/health', initializeServices, async (req: Request, res: Response) => {
  try {
    const vectorHealth = await req.vectorSearchService!.healthCheck();
    
    res.json({
      success: true,
      data: {
        vectorSearch: vectorHealth,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking health:', error);
    res.status(500).json({
      error: 'Failed to check health',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/embeddings/similar/:chunkId
 * @desc Obtenir des chunks similaires à un chunk spécifique
 * @access Public
 */
router.get('/similar/:chunkId', initializeServices, async (req: Request, res: Response) => {
  try {
    const { chunkId } = req.params;
    if (!chunkId) {
      res.status(400).json({
        error: 'Chunk ID is required',
        details: 'Missing chunkId parameter'
      });
      return;
    }
    const limit = parseInt(req.query['limit'] as string) || 10;
    
    const similarChunks = await req.vectorSearchService!.getSimilarChunks(chunkId, limit);
    
    res.json({
      success: true,
      data: similarChunks,
      metadata: {
        chunkId,
        limit,
        resultsCount: similarChunks.length
      }
    });
  } catch (error) {
    console.error('Error finding similar chunks:', error);
    res.status(500).json({
      error: 'Failed to find similar chunks',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/embeddings/export
 * @desc Exporter les analytics dans différents formats
 * @access Public
 */
router.get('/export', initializeServices, async (req: Request, res: Response) => {
  try {
    const timeRange = (req.query['timeRange'] as 'hour' | 'day' | 'week') || 'day';
    const format = (req.query['format'] as 'json' | 'csv') || 'json';
    
    const report = await req.analyticsService!.exportAnalyticsReport(timeRange, format);
    
    const filename = `embeddings-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    
    res.send(report);
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      error: 'Failed to export analytics',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/embeddings/chunk/:chunkId
 * @desc Supprimer l'embedding d'un chunk spécifique
 * @access Public
 */
router.delete('/chunk/:chunkId', initializeServices, async (req: Request, res: Response) => {
  try {
    const { chunkId } = req.params;
    if (!chunkId) {
      res.status(400).json({
        error: 'Chunk ID is required',
        details: 'Missing chunkId parameter'
      });
      return;
    }
    await req.vectorSearchService!.deleteChunkEmbedding(chunkId);
    
    res.json({
      success: true,
      message: 'Embedding deleted successfully',
      metadata: {
        chunkId,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error deleting chunk embedding:', error);
    res.status(500).json({
      error: 'Failed to delete chunk embedding',
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

export default router;
