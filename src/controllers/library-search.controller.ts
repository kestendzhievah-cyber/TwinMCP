import { FastifyRequest, FastifyReply } from 'fastify';
import { LibrarySearchService } from '../services/library-search.service';
import { LibraryAnalyticsService } from '../services/library-analytics.service';
import { CacheService } from '../services/cache.service';
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'popularity', 'quality', 'updated', 'downloads']).default('relevance'),
  order: z.enum(['asc', 'desc']).default('desc'),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'archived']).optional(),
  min_quality: z.number().min(0).max(1).optional(),
  min_popularity: z.number().min(0).max(1).optional(),
  fuzzy: z.boolean().default(true),
  suggestions: z.boolean().default(true)
});

export class LibrarySearchController {
  constructor(
    private searchService: LibrarySearchService,
    private analyticsService: LibraryAnalyticsService,
    private cacheService: CacheService
  ) {}

  async search(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = searchSchema.parse(request.query);
      
      // Vérifier le cache
      const cacheKey = this.generateCacheKey('search', query, (request as any).user?.id);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          cached: true
        });
      }

      // Exécuter la recherche
      const startTime = Date.now();
      const results = await this.searchService.search(query);
      const searchTime = Date.now() - startTime;

      // Logging analytics
      await this.analyticsService.logSearch({
        query: query.q,
        userId: (request as any).user?.id,
        resultCount: results.results.length,
        searchTime,
        filters: {
          tags: query.tags,
          language: query.language,
          license: query.license
        }
      });

      // Mettre en cache
      await this.cacheService.set(cacheKey, results, 300); // 5 minutes

      return reply.send({
        success: true,
        data: results,
        searchTime,
        cached: false
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        error: 'Invalid search parameters'
      });
    }
  }

  async autocomplete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { q, limit = 10 } = request.query as { q: string; limit?: number };
      
      if (q.length < 2) {
        return reply.send({
          success: true,
          data: []
        });
      }

      // Cache pour les requêtes d'autocomplétion
      const cacheKey = `autocomplete:${q}:${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          cached: true
        });
      }

      const suggestions = await this.searchService.autocomplete(q, limit);
      
      // Cache plus long pour l'autocomplétion
      await this.cacheService.set(cacheKey, suggestions, 1800); // 30 minutes

      return reply.send({
        success: true,
        data: suggestions,
        cached: false
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLibrary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      
      // Cache pour les détails de bibliothèque
      const cacheKey = `library:${name}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          cached: true
        });
      }

      const library = await this.searchService.getLibraryDetails(name);
      
      if (!library) {
        return reply.code(404).send({
          success: false,
          error: 'Library not found'
        });
      }

      // Cache plus long pour les détails
      await this.cacheService.set(cacheKey, library, 3600); // 1 heure

      return reply.send({
        success: true,
        data: library,
        cached: false
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLibraryVersions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      
      const versions = await this.searchService.getLibraryVersions(name);
      
      return reply.send({
        success: true,
        data: versions
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLibraryDependencies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      
      const dependencies = await this.searchService.getLibraryDependencies(name);
      
      return reply.send({
        success: true,
        data: dependencies
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getContextualSuggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const context = request.body as {
        project?: {
          dependencies?: string[];
          devDependencies?: string[];
          framework?: string;
        };
        user?: {
          preferences?: {
            languages?: string[];
            tags?: string[];
          };
        };
        query?: string;
      };

      const suggestions = await this.searchService.getContextualSuggestions(context);
      
      return reply.send({
        success: true,
        data: suggestions
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getSearchStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.id;
      
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const stats = await this.analyticsService.getUserSearchStats(userId);
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async exportResults(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = searchSchema.parse(request.query);
      const format = (request.query as any).format as 'json' | 'csv' | 'xlsx' || 'json';
      
      // Limiter l'export pour éviter l'abus
      const limitedQuery = { ...query, limit: Math.min(query.limit, 1000) };
      
      const results = await this.searchService.search(limitedQuery);
      
      // Logging de l'export
      await this.analyticsService.logExport({
        userId: (request as any).user?.id,
        query: query.q,
        resultCount: results.results.length,
        format
      });

      // Formatage selon le type demandé
      let data: string | Buffer;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv':
          data = this.formatAsCSV(results.results);
          contentType = 'text/csv';
          filename = `libraries-${Date.now()}.csv`;
          break;
        case 'xlsx':
          data = await this.formatAsExcel(results.results);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `libraries-${Date.now()}.xlsx`;
          break;
        default:
          data = JSON.stringify(results, null, 2);
          contentType = 'application/json';
          filename = `libraries-${Date.now()}.json`;
      }

      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      
      return reply.send(data);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Export failed'
      });
    }
  }

  private generateCacheKey(type: string, query: any, userId?: string): string {
    const crypto = require('crypto');
    const queryHash = crypto
      .createHash('md5')
      .update(JSON.stringify(query))
      .digest('hex');
    
    return `${type}:${queryHash}${userId ? `:${userId}` : ''}`;
  }

  private formatAsCSV(results: any[]): string {
    const headers = [
      'name', 'displayName', 'description', 'version', 'license',
      'downloads', 'stars', 'qualityScore', 'popularityScore', 'language'
    ];
    
    const csvRows = [
      headers.join(','),
      ...results.map(result => [
        `"${result.name}"`,
        `"${result.displayName || ''}"`,
        `"${(result.description || '').replace(/"/g, '""')}"`,
        `"${result.latestVersion || ''}"`,
        `"${result.license || ''}"`,
        result.weeklyDownloads || 0,
        result.stars || 0,
        result.qualityScore || 0,
        result.popularityScore || 0,
        `"${result.language || ''}"`
      ].join(','))
    ];
    
    return csvRows.join('\n');
  }

  private async formatAsExcel(results: any[]): Promise<Buffer> {
    // Implémentation avec xlsx library
    const XLSX = require('xlsx');
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(results.map(result => ({
      Name: result.name,
      'Display Name': result.displayName || '',
      Description: result.description || '',
      Version: result.latestVersion || '',
      License: result.license || '',
      'Weekly Downloads': result.weeklyDownloads || 0,
      Stars: result.stars || 0,
      'Quality Score': result.qualityScore || 0,
      'Popularity Score': result.popularityScore || 0,
      Language: result.language || ''
    })));
    
    XLSX.utils.book_append_sheet(wb, ws, 'Libraries');
    
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
